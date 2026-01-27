-- Supabase Schema for Ask AI Feature
-- Run this in Supabase SQL Editor

-- 1. Enable pgvector extension
create extension if not exists vector with schema extensions;

-- 2. Create documents table
create table if not exists documents (
  id bigint primary key generated always as identity,
  file_path text not null unique,
  title text not null,
  url_path text not null,
  updated_at timestamp with time zone default now()
);

-- 3. Create document_chunks table
create table if not exists document_chunks (
  id bigint primary key generated always as identity,
  document_id bigint not null references documents(id) on delete cascade,
  content text not null,
  chunk_index integer not null,
  embedding extensions.vector(1024),
  created_at timestamp with time zone default now()
);

-- 4. Create HNSW index for fast vector search
create index if not exists document_chunks_embedding_idx
  on document_chunks
  using hnsw (embedding vector_cosine_ops);

-- 5. Create search function
create or replace function search_docs(
  query_embedding extensions.vector(1024),
  match_count int default 5
)
returns table (
  id bigint,
  content text,
  file_path text,
  title text,
  url_path text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    dc.id,
    dc.content,
    d.file_path,
    d.title,
    d.url_path,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  join documents d on d.id = dc.document_id
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 6. Enable Row Level Security
alter table documents enable row level security;
alter table document_chunks enable row level security;

-- 7. Create read policies (public read access)
drop policy if exists "Allow public read on documents" on documents;
create policy "Allow public read on documents"
  on documents for select
  using (true);

drop policy if exists "Allow public read on document_chunks" on document_chunks;
create policy "Allow public read on document_chunks"
  on document_chunks for select
  using (true);

-- 8. Create write policies (service role only - handled by Supabase automatically)
-- The service_role key bypasses RLS, so no explicit write policies needed
