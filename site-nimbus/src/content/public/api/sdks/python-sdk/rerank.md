# Rerank

> **Caution: Not currently available**
>
> The SDK has a `client.rerank.create()` method, but it calls `POST /v1/rerank`, which `api.apertis.ai` does not serve: every call raises `NotFoundError` (HTTP 404, checked 2026-10-06). Since `apertis` 0.4.0 the method also emits a `DeprecationWarning` saying so.

To order documents by relevance in a RAG pipeline, compare vectors from [`client.embeddings.create()`](/api/sdks/python-sdk/embeddings) instead.
