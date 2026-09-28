-- Rollback of 20260929000000_docs_generations.sql. Run in one transaction
-- (psql --single-transaction -v ON_ERROR_STOP=1 -f ...).
-- Generations are retained for rollback and never garbage-collected here: this refuses to run while any
-- generation or slot exists. Removing retained generations needs a separately approved retention decision.
-- The lock comes first, so no concurrent docs_generation_begin can insert between the check and the drops.
-- The legacy tables and both public.search_docs overloads are not touched.

lock table public.docs_generations, public.docs_generation_documents, public.docs_generation_chunks,
  public.docs_generation_slots in access exclusive mode;

do $$
begin
  if exists (select 1 from public.docs_generations) or exists (select 1 from public.docs_generation_slots) then
    raise exception 'refusing to roll back: generations or slots exist';
  end if;
end;
$$;

drop function public.search_docs_generation(extensions.vector, int, float8, text, text);
drop function public.docs_generation_set_reader(text, text);
drop function public.docs_generation_activate(text, bigint);
drop function public.docs_embedding_cache_lookup(text[], text, text, int);
drop function public.docs_generation_fail(bigint, uuid, text);
drop function public.docs_generation_finish(bigint, uuid);
drop function public.docs_generation_put_document(bigint, uuid, text, jsonb, int);
drop function public.docs_generation_claim(bigint, uuid);
drop function public.docs_generation_begin(text, text, text, text, text, text, int, jsonb, int);

drop table public.docs_generation_slots;
drop table public.docs_generation_chunks;
drop table public.docs_generation_documents;
drop table public.docs_generations;
