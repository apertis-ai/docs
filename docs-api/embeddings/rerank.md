# Rerank API

```
POST /v1/rerank
```

The Rerank API reorders a list of documents based on their relevance to a query. This is useful for improving search results, RAG (Retrieval-Augmented Generation) pipelines, and any application that needs to prioritize documents by semantic relevance.

## HTTP Request

```bash
curl https://api.apertis.ai/v1/rerank \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "BAAI/bge-reranker-v2-m3",
        "query": "What is machine learning?",
        "documents": [
            "Machine learning is a subset of artificial intelligence.",
            "The weather today is sunny.",
            "Deep learning uses neural networks.",
            "Pizza is a popular Italian food."
        ]
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
| `model` | string | ID of the reranker model to use (e.g., `BAAI/bge-reranker-v2-m3`) |
| `query` | string | The search query to rank documents against |
| `documents` | array | Array of document strings to rerank |

## Example Usage

### Python

```python
import httpx

response = httpx.post(
    "https://api.apertis.ai/v1/rerank",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "Content-Type": "application/json"
    },
    json={
        "model": "BAAI/bge-reranker-v2-m3",
        "query": "What is machine learning?",
        "documents": [
            "Machine learning is a subset of artificial intelligence.",
            "The weather today is sunny.",
            "Deep learning uses neural networks.",
            "Pizza is a popular Italian food."
        ]
    }
)

result = response.json()
# Results sorted by relevance score (highest first)
for item in result["results"]:
    doc_index = item["index"]
    score = item["relevance_score"]
    print(f"Document {doc_index}: score={score:.4f}")
```

### JavaScript

```javascript
const response = await fetch('https://api.apertis.ai/v1/rerank', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'BAAI/bge-reranker-v2-m3',
    query: 'What is machine learning?',
    documents: [
      'Machine learning is a subset of artificial intelligence.',
      'The weather today is sunny.',
      'Deep learning uses neural networks.',
      'Pizza is a popular Italian food.'
    ]
  })
});

const result = await response.json();
// Results sorted by relevance score (highest first)
result.results.forEach(item => {
  console.log(`Document ${item.index}: score=${item.relevance_score.toFixed(4)}`);
});
```

### RAG Pipeline Example

```python
import httpx

# Step 1: Initial retrieval (e.g., from vector search)
initial_results = [
    "Machine learning algorithms learn from data without explicit programming.",
    "The stock market closed higher today.",
    "Neural networks are inspired by biological neurons.",
    "Deep learning has revolutionized computer vision.",
    "Weather forecast predicts rain tomorrow."
]

# Step 2: Rerank to improve relevance
response = httpx.post(
    "https://api.apertis.ai/v1/rerank",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "Content-Type": "application/json"
    },
    json={
        "model": "BAAI/bge-reranker-v2-m3",
        "query": "How does machine learning work?",
        "documents": initial_results
    }
)

result = response.json()

# Step 3: Get top-k most relevant documents
top_k = 3
top_docs = sorted(result["results"], key=lambda x: x["relevance_score"], reverse=True)[:top_k]

print("Top relevant documents:")
for item in top_docs:
    print(f"  Score {item['relevance_score']:.4f}: {initial_results[item['index']]}")
```

## Response Format

```json
{
  "results": [
    {
      "index": 0,
      "relevance_score": 0.9523
    },
    {
      "index": 2,
      "relevance_score": 0.8712
    },
    {
      "index": 1,
      "relevance_score": 0.1234
    },
    {
      "index": 3,
      "relevance_score": 0.0456
    }
  ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `results` | array | Array of reranking results |

### Results Object

| Field | Type | Description |
|-------|------|-------------|
| `index` | integer | Index of the document in the original input array |
| `relevance_score` | number | Relevance score between 0 and 1 (higher = more relevant) |

## Supported Models

| Model | Description |
|-------|-------------|
| `BAAI/bge-reranker-v2-m3` | BGE Reranker v2 M3 - Multilingual reranker supporting 100+ languages |

:::tip Model Selection
The `BAAI/bge-reranker-v2-m3` model is a state-of-the-art multilingual reranker that works well for most use cases. It supports over 100 languages and provides high-quality relevance scoring.
:::

## Error Responses

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid parameters or empty documents array |
| 401 | Unauthorized - Invalid API key |
| 402 | Payment Required - Insufficient quota |
| 429 | Rate Limited - Too many requests |
| 500 | Internal Server Error |
| 503 | Service Unavailable - Model not available |

## Use Cases

- **Search Result Reranking**: Improve search quality by reordering initial retrieval results
- **RAG Pipelines**: Select the most relevant documents for LLM context
- **Document Deduplication**: Identify semantically similar documents
- **Content Recommendation**: Rank content by relevance to user preferences
- **Question Answering**: Select the best passages to answer a question

## Best Practices

1. **Batch Processing**: Send multiple documents in a single request for efficiency
2. **Top-K Selection**: After reranking, typically only use the top 3-5 most relevant documents
3. **Combine with Embeddings**: Use embeddings for initial retrieval, then rerank for precision
4. **Query Optimization**: Use clear, specific queries for better reranking results

## Related Topics

- [Embeddings API](/api/embeddings/embeddings-api) - Generate text embeddings for semantic search
- [Chat Completions API](/api/text-generation/chat-completions) - Text generation with context
- [Models](/api/utilities/models) - List available models
