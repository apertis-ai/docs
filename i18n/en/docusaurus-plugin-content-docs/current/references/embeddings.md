# Embedding API

Stima API provides the Embedding API for developers to convert text into vectors and find similar text through vector search.

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
   'Authorization': 'Bearer <STIMA_API_KEY>',
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
- `STIMA_API_KEY`: Your API key

