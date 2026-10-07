---
title: "Rerank"
description: "client.rerank.create() calls /v1/rerank, which is not currently available on the Apertis API."
---

# Rerank

<aside class="admonition admonition-caution">
<p class="admonition-title">Not currently available</p>

The SDK has a `client.rerank.create()` method, but it calls `POST /v1/rerank`, which `api.apertis.ai` does not serve: every call raises `NotFoundError` (HTTP 404, checked 2026-10-06). Since `apertis` 0.4.0 the method also emits a `DeprecationWarning` saying so.

</aside>

To order documents by relevance in a RAG pipeline, compare vectors from [`client.embeddings.create()`](/api/sdks/python-sdk/embeddings) instead.
