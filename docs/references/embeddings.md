# Embeddings API

```
POST /v1/embeddings
```

The Embeddings API is an **OpenAI-compatible endpoint** that converts text into numerical vector representations. These embeddings can be used for semantic search, clustering, recommendations, and other machine learning tasks.

:::info OpenAI Compatible
This endpoint is fully compatible with OpenAI's Embeddings API format. You can use OpenAI SDKs directly with Apertis by changing the base URL.
:::

## HTTP Request

```bash
curl https://api.apertis.ai/v1/embeddings \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "text-embedding-3-small",
        "input": "The food was delicious and the waiter was friendly."
    }'
```

## Authentication

| Header | Format | Example |
|--------|--------|---------|
| `Authorization` | Bearer token | `Authorization: Bearer sk-your-api-key` |

## Parameters

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | ID of the embedding model to use (e.g., `text-embedding-3-small`, `text-embedding-3-large`) |
| `input` | string/array | Text to embed. Can be a string or array of strings. Each input must not exceed 8192 tokens. |

### Optional Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `encoding_format` | string | Format for the embeddings: `float` (default) or `base64` |
| `dimensions` | integer | Number of dimensions for the output embeddings. Only supported by `text-embedding-3` models. |
| `user` | string | Unique identifier for end-user tracking |

## Example Usage

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-api-key",
    base_url="https://api.apertis.ai/v1"
)

response = client.embeddings.create(
    model="text-embedding-3-small",
    input="The food was delicious and the waiter was friendly."
)

print(response.data[0].embedding)
```

### JavaScript (OpenAI SDK)

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-api-key',
  baseURL: 'https://api.apertis.ai/v1'
});

const response = await client.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'The food was delicious and the waiter was friendly.'
});

console.log(response.data[0].embedding);
```

### Multiple Inputs

```python
response = client.embeddings.create(
    model="text-embedding-3-small",
    input=[
        "The food was delicious.",
        "The service was excellent.",
        "I would recommend this restaurant."
    ]
)

for item in response.data:
    print(f"Index {item.index}: {len(item.embedding)} dimensions")
```

### With Dimensions Parameter

```python
# Reduce dimensions for storage efficiency (text-embedding-3 models only)
response = client.embeddings.create(
    model="text-embedding-3-large",
    input="The food was delicious and the waiter was friendly.",
    dimensions=256  # Reduce from 3072 to 256 dimensions
)

print(f"Embedding dimensions: {len(response.data[0].embedding)}")
```

### With All Parameters

```python
response = client.embeddings.create(
    model="text-embedding-3-small",
    input="The food was delicious and the waiter was friendly.",
    encoding_format="float",
    dimensions=512,
    user="user-123"
)
```

## Response Format

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.0023064255, -0.009327292, ...]
    }
  ],
  "model": "text-embedding-3-small",
  "usage": {
    "prompt_tokens": 12,
    "total_tokens": 12
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `object` | string | Object type, always `list` |
| `data` | array | List of embedding objects |
| `model` | string | The model used for embedding |
| `usage` | object | Token usage statistics |

### Data Object

| Field | Type | Description |
|-------|------|-------------|
| `object` | string | Object type, always `embedding` |
| `index` | integer | Index of this embedding in the input array |
| `embedding` | array | The embedding vector (list of floats) |

### Usage Object

| Field | Type | Description |
|-------|------|-------------|
| `prompt_tokens` | integer | Tokens in the input text |
| `total_tokens` | integer | Total tokens used |

## Supported Models

### OpenAI Models

| Model | Dimensions | Max Input | Description |
|-------|------------|-----------|-------------|
| `text-embedding-3-large` | 3072 | 8191 tokens | Most capable embedding model |
| `text-embedding-3-small` | 1536 | 8191 tokens | Efficient smaller model |
| `text-embedding-ada-002` | 1536 | 8191 tokens | Legacy model |

### Jina AI Models

| Model | Description |
|-------|-------------|
| `jina-embeddings-v3` | Latest multilingual embedding model |
| `jina-clip-v2` | Multimodal (text + image) embeddings |
| `jina-colbert-v2` | Late interaction model for retrieval |
| `jina-embeddings-v2-base-code` | Optimized for code |
| `jina-embeddings-v2-base-zh` | Optimized for Chinese |
| `jina-embeddings-v2-base-en` | Optimized for English |

:::tip Dimension Reduction
The `text-embedding-3` models support the `dimensions` parameter, allowing you to shorten embeddings for storage efficiency. This trades off some accuracy for smaller vector sizes.
:::

## Error Responses

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid parameters or input too long |
| 401 | Unauthorized - Invalid API key |
| 402 | Payment Required - Insufficient quota |
| 429 | Rate Limited - Too many requests |
| 500 | Internal Server Error |
| 503 | Service Unavailable - Model not available |

## Use Cases

- **Semantic Search**: Find documents similar to a query
- **Clustering**: Group similar texts together
- **Recommendations**: Suggest related content
- **Anomaly Detection**: Identify outliers in text data
- **Classification**: Use embeddings as features for ML models

## Related Topics

- [Chat Completions API](/references/chat_completions) - Text generation
- [Models](/references/models) - List available models
