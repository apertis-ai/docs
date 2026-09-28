-- #11: generation-isolated documentation retrieval. Additive only.
-- The legacy tables documents / document_chunks and both public.search_docs overloads are not touched.
-- Rollback: supabase/migrations/rollback/20260929000000_docs_generations.down.sql
--
-- Model
--   docs_generations            one candidate corpus per (environment, manifest buildId) attempt:
--                               building -> ready | failed. Rows are never deleted.
--   docs_generation_documents   the plan: one row per rag-eligible manifest document, pending -> complete.
--   docs_generation_chunks      chunks of a document; written together with its completion, in one call.
--   docs_generation_slots       per environment: the reader-secret hash and the active (served) generation.
--
-- Guards
--   * at most one building-or-ready generation per (environment, buildId): partial unique index;
--   * a document becomes complete only in the same transaction that wrote all its planned chunks, and only
--     when their content hashes match the plan (docs_generation_put_document);
--   * ready only when every planned document is complete and counts and hashes re-validate
--     (docs_generation_finish);
--   * writes require the run's token and an unexpired lease, so a run that lost its lease (cancelled,
--     killed, taken over) can no longer write;
--   * one active generation per environment (slot primary key); activation is owner-only, never the indexer.
--
-- Privileges: no table is readable or writable by anon or authenticated (RLS on, no policies, grants
-- revoked, including TRUNCATE, which RLS does not cover). service_role may only SELECT the tables and
-- execute the indexer functions. Readers use search_docs_generation, which needs a per-environment secret.

create table public.docs_generations (
  id bigint generated always as identity primary key,
  environment text not null check (environment ~ '^[a-z][a-z0-9-]{0,31}$'),
  build_id text not null check (build_id ~ '^[0-9a-f]{40}\.[0-9a-f]{12}$'),
  source_sha text not null check (source_sha ~ '^[0-9a-f]{40}$'),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  chunker_version text not null check (chunker_version <> ''),
  embedding_model text not null check (embedding_model <> ''),
  embedding_dimensions int not null check (embedding_dimensions = 1024),
  state text not null default 'building' check (state in ('building', 'ready', 'failed')),
  run_token uuid not null default gen_random_uuid(),
  lease_expires_at timestamptz not null,
  expected_documents int not null check (expected_documents > 0),
  expected_chunks int not null check (expected_chunks > 0),
  failure text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  check (left(build_id, 40) = source_sha)
);
create unique index docs_generations_one_live_build on public.docs_generations (environment, build_id) where state <> 'failed';

create table public.docs_generation_documents (
  generation_id bigint not null references public.docs_generations(id),
  doc_id text not null check (doc_id <> ''),
  title text not null,
  url_path text not null check (url_path ~ '^/' and url_path !~ '^//'),
  canonical_url text not null,
  source_path text not null,
  served_path text not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  chunk_count int not null check (chunk_count > 0),
  chunks_sha256 text not null check (chunks_sha256 ~ '^[0-9a-f]{64}$'),
  state text not null default 'pending' check (state in ('pending', 'complete')),
  completed_at timestamptz,
  primary key (generation_id, doc_id),
  unique (generation_id, url_path)
);

-- ponytail: exact scan over one generation's chunks (primary key prefix). A filtered HNSW scan can return
-- fewer than match_count rows once several generations are retained; add HNSW with iterative scans only
-- if one generation grows past tens of thousands of chunks.
create table public.docs_generation_chunks (
  generation_id bigint not null,
  doc_id text not null,
  chunk_index int not null check (chunk_index >= 0),
  content text not null,
  content_sha256 text not null,
  anchor text not null check (anchor <> ''),
  embedding extensions.vector(1024) not null,
  primary key (generation_id, doc_id, chunk_index),
  foreign key (generation_id, doc_id) references public.docs_generation_documents(generation_id, doc_id)
);
create index docs_generation_chunks_content_sha256 on public.docs_generation_chunks (content_sha256);

create table public.docs_generation_slots (
  environment text primary key check (environment ~ '^[a-z][a-z0-9-]{0,31}$'),
  reader_token_sha256 text check (reader_token_sha256 ~ '^[0-9a-f]{64}$'),
  active_generation_id bigint references public.docs_generations(id),
  previous_generation_id bigint references public.docs_generations(id),
  activated_at timestamptz
);

alter table public.docs_generations enable row level security;
alter table public.docs_generation_documents enable row level security;
alter table public.docs_generation_chunks enable row level security;
alter table public.docs_generation_slots enable row level security;

-- Start a generation from the manifest plan, or report the existing ready one for identical inputs.
-- p_documents: [{doc_id, title, url_path, canonical_url, source_path, served_path, content_sha256,
-- chunk_count, chunks_sha256}]. A building generation whose lease expired is marked failed and replaced.
create function public.docs_generation_begin(
  p_environment text, p_build_id text, p_source_sha text, p_manifest_sha256 text, p_chunker_version text,
  p_embedding_model text, p_embedding_dimensions int, p_documents jsonb, p_lease_seconds int default 900)
returns table (generation_id bigint, run_token uuid, state text)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  g public.docs_generations;
begin
  if p_lease_seconds is null or p_lease_seconds not between 1 and 3600 then
    raise exception 'lease must be 1..3600 seconds';
  end if;
  if jsonb_typeof(p_documents) is distinct from 'array' or jsonb_array_length(p_documents) = 0 then
    raise exception 'the plan has no documents';
  end if;

  select * into g from public.docs_generations x
  where x.environment = p_environment and x.build_id = p_build_id and x.state <> 'failed'
  for update;
  if found then
    if g.state = 'ready' then
      if g.manifest_sha256 <> p_manifest_sha256 or g.chunker_version <> p_chunker_version
         or g.embedding_model <> p_embedding_model or g.embedding_dimensions <> p_embedding_dimensions then
        raise exception 'build % is already ready in % with different inputs', p_build_id, p_environment;
      end if;
      return query select g.id, null::uuid, g.state;
      return;
    end if;
    if g.lease_expires_at > now() then
      raise exception 'generation % (build %) is being built by another run', g.id, p_build_id;
    end if;
    update public.docs_generations x set state = 'failed', failure = 'lease expired', finished_at = now()
    where x.id = g.id;
  end if;

  insert into public.docs_generations (environment, build_id, source_sha, manifest_sha256, chunker_version,
    embedding_model, embedding_dimensions, lease_expires_at, expected_documents, expected_chunks)
  select p_environment, p_build_id, p_source_sha, p_manifest_sha256, p_chunker_version, p_embedding_model,
    p_embedding_dimensions, now() + make_interval(secs => p_lease_seconds), count(*), sum(x.chunk_count)
  from jsonb_to_recordset(p_documents) as x(chunk_count int)
  returning * into g;

  insert into public.docs_generation_documents (generation_id, doc_id, title, url_path, canonical_url,
    source_path, served_path, content_sha256, chunk_count, chunks_sha256)
  select g.id, x.doc_id, x.title, x.url_path, x.canonical_url, x.source_path, x.served_path,
    x.content_sha256, x.chunk_count, x.chunks_sha256
  from jsonb_to_recordset(p_documents) as x(doc_id text, title text, url_path text, canonical_url text,
    source_path text, served_path text, content_sha256 text, chunk_count int, chunks_sha256 text);

  return query select g.id, g.run_token, g.state;
end;
$$;

-- Lock the run's generation; raise unless this run still owns it with a live lease.
create function public.docs_generation_claim(p_generation_id bigint, p_run_token uuid)
returns public.docs_generations
language plpgsql security definer set search_path = ''
as $$
declare
  g public.docs_generations;
begin
  select * into g from public.docs_generations x where x.id = p_generation_id for update;
  if not found or g.run_token is distinct from p_run_token then
    raise exception 'generation % is not owned by this run', p_generation_id;
  end if;
  if g.state <> 'building' then
    raise exception 'generation % is %, not building', p_generation_id, g.state;
  end if;
  if g.lease_expires_at <= now() then
    raise exception 'generation % lease expired', p_generation_id;
  end if;
  return g;
end;
$$;

-- Write all chunks of one planned document and mark it complete, atomically.
-- p_chunks: [{chunk_index, content, anchor, embedding: number[1024]}].
create function public.docs_generation_put_document(
  p_generation_id bigint, p_run_token uuid, p_doc_id text, p_chunks jsonb, p_lease_seconds int default 900)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  d public.docs_generation_documents;
  n int;
  got text;
begin
  perform public.docs_generation_claim(p_generation_id, p_run_token);
  if p_lease_seconds is null or p_lease_seconds not between 1 and 3600 then
    raise exception 'lease must be 1..3600 seconds';
  end if;
  select * into d from public.docs_generation_documents x
  where x.generation_id = p_generation_id and x.doc_id = p_doc_id for update;
  if not found then
    raise exception 'document % is not in the plan of generation %', p_doc_id, p_generation_id;
  end if;
  if d.state <> 'pending' then
    raise exception 'document % is already %', p_doc_id, d.state;
  end if;
  n := coalesce(jsonb_array_length(p_chunks), 0);
  if n <> d.chunk_count then
    raise exception 'document % has % chunks, planned %', p_doc_id, n, d.chunk_count;
  end if;

  insert into public.docs_generation_chunks (generation_id, doc_id, chunk_index, content, content_sha256, anchor, embedding)
  select p_generation_id, p_doc_id, x.chunk_index, x.content,
    encode(sha256(convert_to(x.content, 'UTF8')), 'hex'), x.anchor, x.embedding::extensions.vector(1024)
  from jsonb_to_recordset(p_chunks) as x(chunk_index int, content text, anchor text, embedding text);

  select encode(sha256(convert_to(string_agg(c.content_sha256, E'\n' order by c.chunk_index), 'UTF8')), 'hex')
  into got
  from public.docs_generation_chunks c
  where c.generation_id = p_generation_id and c.doc_id = p_doc_id
  having min(c.chunk_index) = 0 and max(c.chunk_index) = n - 1;
  if got is distinct from d.chunks_sha256 then
    raise exception 'chunks of document % do not match the plan', p_doc_id;
  end if;

  update public.docs_generation_documents x set state = 'complete', completed_at = now()
  where x.generation_id = p_generation_id and x.doc_id = p_doc_id;
  update public.docs_generations x set lease_expires_at = now() + make_interval(secs => p_lease_seconds)
  where x.id = p_generation_id;
  return n;
end;
$$;

-- Re-validate the whole generation and mark it ready. Raises (and changes nothing) on any mismatch.
create function public.docs_generation_finish(p_generation_id bigint, p_run_token uuid)
returns table (documents int, chunks int)
language plpgsql security definer set search_path = ''
as $$
declare
  g public.docs_generations;
  n_docs int;
  n_chunks int;
  bad text;
begin
  g := public.docs_generation_claim(p_generation_id, p_run_token);

  select string_agg(d.doc_id, ', ' order by d.doc_id) into bad
  from public.docs_generation_documents d
  left join lateral (
    select count(*) as n,
      encode(sha256(convert_to(string_agg(c.content_sha256, E'\n' order by c.chunk_index), 'UTF8')), 'hex') as h
    from public.docs_generation_chunks c
    where c.generation_id = d.generation_id and c.doc_id = d.doc_id
  ) c on true
  where d.generation_id = p_generation_id
    and (d.state <> 'complete' or c.n <> d.chunk_count or c.h is distinct from d.chunks_sha256);
  if bad is not null then
    raise exception 'generation % is incomplete: %', p_generation_id, bad;
  end if;

  select count(*) into n_docs from public.docs_generation_documents d where d.generation_id = p_generation_id;
  select count(*) into n_chunks from public.docs_generation_chunks c where c.generation_id = p_generation_id;
  if n_docs <> g.expected_documents or n_chunks <> g.expected_chunks then
    raise exception 'generation % has % documents and % chunks, expected % and %',
      p_generation_id, n_docs, n_chunks, g.expected_documents, g.expected_chunks;
  end if;

  update public.docs_generations x set state = 'ready', finished_at = now() where x.id = p_generation_id;
  return query select n_docs, n_chunks;
end;
$$;

-- Mark the run's own building generation failed. Returns false when it no longer owns a building one.
create function public.docs_generation_fail(p_generation_id bigint, p_run_token uuid, p_reason text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  update public.docs_generations x set state = 'failed', failure = left(p_reason, 500), finished_at = now()
  where x.id = p_generation_id and x.run_token = p_run_token and x.state = 'building';
  return found;
end;
$$;

-- Embeddings of completed documents whose chunk content, chunker and embedding identity match.
create function public.docs_embedding_cache_lookup(
  p_content_sha256 text[], p_chunker_version text, p_embedding_model text, p_embedding_dimensions int)
returns table (content_sha256 text, embedding text)
language sql stable security definer set search_path = ''
as $$
  select distinct on (c.content_sha256) c.content_sha256, c.embedding::text
  from public.docs_generation_chunks c
  join public.docs_generation_documents d on d.generation_id = c.generation_id and d.doc_id = c.doc_id
  join public.docs_generations g on g.id = c.generation_id
  where d.state = 'complete' and c.content_sha256 = any (p_content_sha256)
    and g.chunker_version = p_chunker_version and g.embedding_model = p_embedding_model
    and g.embedding_dimensions = p_embedding_dimensions
  order by c.content_sha256, c.generation_id desc;
$$;

-- Operator only (not granted to any API role): serve a ready generation in its own environment.
-- Rollback is activating the returned previous generation again.
create function public.docs_generation_activate(p_environment text, p_generation_id bigint)
returns table (environment text, active_generation_id bigint, previous_generation_id bigint)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  g public.docs_generations;
begin
  select * into g from public.docs_generations x where x.id = p_generation_id for share;
  if not found or g.state <> 'ready' or g.environment <> p_environment then
    raise exception 'generation % is not a ready generation of %', p_generation_id, p_environment;
  end if;
  insert into public.docs_generation_slots as s (environment, active_generation_id, activated_at)
  values (p_environment, p_generation_id, now())
  on conflict (environment) do update
    set previous_generation_id = s.active_generation_id, active_generation_id = excluded.active_generation_id,
        activated_at = excluded.activated_at
    where s.active_generation_id is distinct from excluded.active_generation_id;
  return query select s.environment, s.active_generation_id, s.previous_generation_id
  from public.docs_generation_slots s where s.environment = p_environment;
end;
$$;

-- Operator only: set the SHA-256 (hex) of the environment's reader secret. The secret itself stays in
-- the server environment (ASK_GENERATION_READER_TOKEN) and never in the database.
create function public.docs_generation_set_reader(p_environment text, p_reader_token_sha256 text)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.docs_generation_slots as s (environment, reader_token_sha256)
  values (p_environment, p_reader_token_sha256)
  on conflict (environment) do update set reader_token_sha256 = excluded.reader_token_sha256;
$$;

-- The only reader. Serves the active ready generation of the environment whose reader secret matches;
-- missing, unknown, not-ready or foreign-environment state raises instead of falling back anywhere.
-- Same semantics as the legacy 3-argument search_docs: cosine similarity > threshold, nearest first.
create function public.search_docs_generation(
  query_embedding extensions.vector, match_count int, similarity_threshold float8,
  target_environment text, reader_token text)
returns table (title text, url_path text, content text, similarity float8, generation_id bigint, environment text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  s public.docs_generation_slots;
  g public.docs_generations;
begin
  select * into s from public.docs_generation_slots x
  where x.environment = target_environment
    and x.reader_token_sha256 = encode(sha256(convert_to(coalesce(reader_token, ''), 'UTF8')), 'hex');
  if not found then
    raise exception 'generation retrieval is not configured' using errcode = '42501';
  end if;
  if s.active_generation_id is null then
    raise exception 'no active generation' using errcode = 'P0002';
  end if;
  select * into g from public.docs_generations x where x.id = s.active_generation_id;
  if g.state <> 'ready' or g.environment <> s.environment then
    raise exception 'active generation is not servable' using errcode = 'P0003';
  end if;
  return query
  select d.title, d.url_path, c.content,
    1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity, g.id, g.environment
  from public.docs_generation_chunks c
  join public.docs_generation_documents d on d.generation_id = c.generation_id and d.doc_id = c.doc_id
  where c.generation_id = g.id
    and 1 - (c.embedding operator(extensions.<=>) query_embedding) > similarity_threshold
  order by c.embedding operator(extensions.<=>) query_embedding
  limit match_count;
end;
$$;

-- Privileges. Supabase grants everything on new public objects to anon, authenticated and service_role
-- by default, and Postgres grants EXECUTE on new functions to PUBLIC: revoke both explicitly.
revoke all on table public.docs_generations, public.docs_generation_documents, public.docs_generation_chunks,
  public.docs_generation_slots from public, anon, authenticated, service_role;
revoke all on sequence public.docs_generations_id_seq from public, anon, authenticated, service_role;
grant select on table public.docs_generations, public.docs_generation_documents, public.docs_generation_chunks,
  public.docs_generation_slots to service_role;

revoke all on function
  public.docs_generation_begin(text, text, text, text, text, text, int, jsonb, int),
  public.docs_generation_claim(bigint, uuid),
  public.docs_generation_put_document(bigint, uuid, text, jsonb, int),
  public.docs_generation_finish(bigint, uuid),
  public.docs_generation_fail(bigint, uuid, text),
  public.docs_embedding_cache_lookup(text[], text, text, int),
  public.docs_generation_activate(text, bigint),
  public.docs_generation_set_reader(text, text),
  public.search_docs_generation(extensions.vector, int, float8, text, text)
from public, anon, authenticated, service_role;

grant execute on function
  public.docs_generation_begin(text, text, text, text, text, text, int, jsonb, int),
  public.docs_generation_put_document(bigint, uuid, text, jsonb, int),
  public.docs_generation_finish(bigint, uuid),
  public.docs_generation_fail(bigint, uuid, text),
  public.docs_embedding_cache_lookup(text[], text, text, int)
to service_role;

grant execute on function public.search_docs_generation(extensions.vector, int, float8, text, text)
to anon, authenticated, service_role;
