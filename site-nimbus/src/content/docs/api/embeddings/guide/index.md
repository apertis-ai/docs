---
title: "Embedding API"
---

# Embedding API

Apertis provides the Embedding API for developers to convert text into vectors and find similar text through vector search.

## Usage (Example in Python)

```python
import http.client
import json

conn = http.client.HTTPSConnection("api.apertis.ai")
payload = json.dumps({
   "model": "jina-embeddings-v3",
   "input": "The food was delicious and the waiter..."
})
headers = {
   'Authorization': 'Bearer <APERTIS_API_KEY>',
   'Content-Type': 'application/json'
}
conn.request("POST", "/v1/embeddings", payload, headers)
res = conn.getresponse()
data = res.read()
print(data.decode("utf-8"))
```

## Parameters

- `model`: The model to use, currently supports `jina-embeddings-v3`, `jina-embeddings-v4`, `jina-embeddings-v5-text-small`, `jina-embeddings-v5-text-nano`, `jina-clip-v1`, `jina-colbert-v2` from **Jina AI**, `mistral-embed-2312` from **Mistral AI** and `gemini-embedding-2-preview` from **Google**. See [Models](/models) for the current list.
- `input`: The text to convert
- `APERTIS_API_KEY`: Your API key

## Jina AI Embedding Model Usage (Example in Python)

```bash
curl -X POST "https://api.apertis.ai/v1/embeddings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <APERTIS_API_KEY>" \
  -d '{
    "model": "jina-embeddings-v3",
    "input": ["你好，世界", "Hello, World"],
    "task": "retrieval.passage"
  }'

```

### Parameters

- `model`: The model to use, currently supports `jina-embeddings-v3`, `jina-embeddings-v4`, `jina-embeddings-v5-text-small`, `jina-embeddings-v5-text-nano`, `jina-embeddings-v2-base-de`, `jina-embeddings-v2-base-es`, `jina-clip-v1`, `jina-colbert-v1-en`, `jina-colbert-v2` from **Jina AI**.
- `input`: The text to convert
- `task`: The task to use, currently supports `retrieval.query`, `retrieval.passage`, `separation`, `classification`, `text-matching` and `none` from **Jina AI** with model `jina-embeddings-v3`.
- `APERTIS_API_KEY`: Your API key
