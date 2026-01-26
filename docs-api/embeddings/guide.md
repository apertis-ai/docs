# Embedding API

Apertis provides the Embedding API for developers to convert text into vectors and find similar text through vector search.

## Usage (Example in Python)

```python
import http.client
import json

conn = http.client.HTTPSConnection("api.apertis.ai")
payload = json.dumps({
   "model": "text-embedding-3-large",
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

- `model`: The model to use, currently supports `text-embedding-3-large`, `text-embedding-3-small`, `text-embedding-ada-002` from **OpenAI** and `jina-embeddings-v3`, `jina-clip-v2`, `jina-colbert-v2`, `jina-embeddings-v2-base-code`, `jina-embeddings-v2-base-zh`, `jina-embeddings-v2-base-en` from **Jina AI**.
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

- `model`: The model to use, currently supports `jina-embeddings-v3`, `jina-clip-v2`, `jina-colbert-v2`, `jina-embeddings-v2-base-code`, `jina-embeddings-v2-base-zh`, `jina-embeddings-v2-base-en`, `jina-embeddings-v2-base-de`, `jina-clip-v1`, `jina-embeddings-v2-base-es`, `jina-colbert-v1-en` from **Jina AI**.
- `input`: The text to convert
- `task`: The task to use, currently supports `retrieval.query`, `retrieval.passage`, `separation`, `classification`, `text-matching` and `none` from **Jina AI** with model `jina-embeddings-v3`.
- `APERTIS_API_KEY`: Your API key
