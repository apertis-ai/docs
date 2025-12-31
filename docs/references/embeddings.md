# 使用 Embedding API

Stima API 提供 Embedding API 讓開發者可以將文字轉換為向量，並且可以透過向量搜尋的方式找到相似的文字。

## 使用方式 (以 Python 為例)

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

## 參數說明

- `model`: 要使用的模型，目前支援 **OpenAI** 的 `text-embedding-3-large`, `text-embedding-3-small`, `text-embedding-ada-002` 以及 **Jina AI** 的 `jina-embeddings-v3`, `jina-clip-v2`, `jina-colbert-v2`, `jina-embeddings-v2-base-code`, `jina-embeddings-v2-base-zh`, `jina-embeddings-v2-base-en`。
- `input`: 要轉換的文字
- `STIMA_API_KEY`: 您的 API 金鑰

