-- Local replica of the production ask-docs retrieval schema, from the lead's read-only capture
-- (scratchpad ask-docs-schema.md, 2026-09-29). Test fixture only: never applied anywhere but PGlite.
-- Includes Supabase's role model and default privileges, because a migration's new tables and
-- functions inherit them: without these, the migration's explicit REVOKEs would prove nothing.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema extensions;
create extension vector with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Supabase defaults: everything created by postgres in public is granted to the API roles.
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;

create table public.documents (
  id bigint generated always as identity primary key,
  file_path text not null constraint documents_file_path_key unique,
  title text not null,
  url_path text not null,
  updated_at timestamptz default now(),
  content_hash text
);

create table public.document_chunks (
  id bigint generated always as identity primary key,
  document_id bigint not null references public.documents(id) on delete cascade,
  content text not null,
  chunk_index int not null,
  embedding extensions.vector(1024),
  created_at timestamptz default now()
);
create index document_chunks_embedding_idx on public.document_chunks using hnsw (embedding extensions.vector_cosine_ops);

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
create policy "Allow public read on documents" on public.documents for select to public using (true);
create policy "Allow public read on document_chunks" on public.document_chunks for select to public using (true);

create function public.search_docs(query_embedding extensions.vector, match_count int default 5, similarity_threshold float8 default 0.3)
returns table(id bigint, content text, file_path text, title text, url_path text, similarity float8)
language plpgsql security invoker set search_path to 'extensions', 'public'
as $$
begin
  return query
  select dc.id, dc.content, d.file_path, d.title, d.url_path, 1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc join documents d on d.id = dc.document_id
  where 1 - (dc.embedding <=> query_embedding) > similarity_threshold
  order by dc.embedding <=> query_embedding limit match_count;
end;
$$;

create function public.search_docs(query_embedding extensions.vector, match_count int default 5)
returns table(id bigint, content text, file_path text, title text, url_path text, similarity float8)
language plpgsql security invoker set search_path to 'extensions', 'public'
as $$
begin
  return query
  select dc.id, dc.content, d.file_path, d.title, d.url_path, 1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc join documents d on d.id = dc.document_id
  order by dc.embedding <=> query_embedding limit match_count;
end;
$$;
