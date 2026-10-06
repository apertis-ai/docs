# Rerank

:::caution Not currently available
`apertis` 0.3.0 has a `client.rerank.create()` method, but it calls `POST /v1/rerank`, which `api.apertis.ai` does not serve: every call raises `NotFoundError` (HTTP 404, checked 2026-10-06).
:::

To order documents by relevance in a RAG pipeline, compare vectors from [`client.embeddings.create()`](./embeddings) instead.
