-- Isolated rehearsal only (#14): the legacy retrieval objects that production's `ask-docs` project serves,
-- reconstructed from migration/nimbus/legacy-rollback.json (production has no tracked migration for
-- them). The 7b6ef85 indexer then fills them with the isolated Jina key, so the legacy handler (rollback
-- target) and the candidate handler with ASK_RETRIEVAL_SOURCE=legacy answer in the isolated project.
-- Never run against production: production already has these objects, and they must stay unmodified.
-- It refuses any database that already has public.documents and changes nothing there (one transaction,
-- no `or replace`, no `drop`). For the same reason it runs only once in the isolated project.
begin;
do $$ begin
  if to_regclass('public.documents') is not null then
    raise exception 'public.documents exists: this is not a fresh isolated project, nothing was changed';
  end if;
end $$;
create extension if not exists vector;

create table public.documents (
  id bigint generated always as identity primary key,
  file_path text unique,
  title text,
  url_path text,
  updated_at timestamptz default now(),
  content_hash text
);

create table public.document_chunks (
  id bigint generated always as identity primary key,
  document_id bigint references public.documents(id),
  content text,
  chunk_index int,
  embedding vector(1024),
  created_at timestamptz default now()
);

create index document_chunks_embedding_idx on public.document_chunks using hnsw (embedding vector_cosine_ops);

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
create policy documents_read on public.documents for select to public using (true);
create policy document_chunks_read on public.document_chunks for select to public using (true);

-- The overload the legacy handler calls: 1 - cosine distance above the threshold, nearest first.
create function public.search_docs(query_embedding vector, match_count integer default 5, similarity_threshold double precision default 0.3)
returns table (id bigint, content text, file_path text, title text, url_path text, similarity double precision)
language sql stable as $$
  select c.id, c.content, d.file_path, d.title, d.url_path, 1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c join public.documents d on d.id = c.document_id
  where 1 - (c.embedding <=> query_embedding) > similarity_threshold
  order by c.embedding <=> query_embedding
  limit match_count
$$;

-- Newer projects do not grant API roles on tables created over a direct connection.
grant select on public.documents, public.document_chunks to anon, authenticated;
grant select, insert, update, delete on public.documents, public.document_chunks to service_role;
grant execute on function public.search_docs(vector, integer, double precision) to anon, authenticated, service_role;
commit;
