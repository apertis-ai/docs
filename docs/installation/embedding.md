# 使用 Embedding API

Apertis 提供 Embedding API 讓開發者可以將文字轉換為向量，並且可以透過向量搜尋的方式找到相似的文字。

## OpenAI Embedding Model 使用方式 (以 Python 為例)

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

### 參數說明

- `model`: 模型目前支援 **OpenAI** 的 `text-embedding-3-large`, `text-embedding-3-small`, `text-embedding-ada-002` 以及 **Jina AI** 的 `jina-embeddings-v3`, `jina-clip-v2`, `jina-colbert-v2`, `jina-embeddings-v2-base-code`, `jina-embeddings-v2-base-zh`, `jina-embeddings-v2-base-en`。
- `input`: 要轉換的文字
- `APERTIS_API_KEY`: 您的 API 金鑰

## Jina AI Embedding Model 使用方式 (以 Python 為例)

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
### 參數說明

- `model`: 模型目前支援 **Jina AI** 的 `jina-embeddings-v3`, `jina-clip-v2`, `jina-colbert-v2`, `jina-embeddings-v2-base-code`, `jina-embeddings-v2-base-zh`, `jina-embeddings-v2-base-en`, `jina-embeddings-v2-base-de`, `jina-clip-v1`, `jina-embeddings-v2-base-es`, `jina-colbert-v1-en`。
- `input`: 要轉換的文字
- `task`: 任務目前支援`jina-embeddings-v3` 的 `retrieval.query`, `retrieval.passage`, `separation`, `classification`, `text-matching` 以及 `none`。與 Jina AI 官網提供的任務選項相同。
- `APERTIS_API_KEY`: 您的 API 金鑰
