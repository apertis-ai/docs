# Embedding API

Apertis provides the Embedding API for developers to convert text into vectors and find similar text through vector search.

## Usage (Example in Python)

```bash tab="cURL"
curl https://api.apertis.ai/v1/embeddings \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "jina-embeddings-v3",
        "input": "The food was delicious and the waiter..."
    }'
```

```python tab="Python"
from openai import OpenAI

client = OpenAI(
    api_key="<APERTIS_API_KEY>",
    base_url="https://api.apertis.ai/v1"
)

response = client.embeddings.create(
    model="jina-embeddings-v3",
    input="The food was delicious and the waiter..."
)

print(response.data[0].embedding)
```

```javascript tab="JavaScript"
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: '<APERTIS_API_KEY>',
  baseURL: 'https://api.apertis.ai/v1'
});

const response = await client.embeddings.create({
  model: 'jina-embeddings-v3',
  input: 'The food was delicious and the waiter...'
});

console.log(response.data[0].embedding);
```

## Parameters

- `model`: The model to use, currently supports `text-embedding-3-large`, `text-embedding-3-small`, `text-embedding-ada-002` from **OpenAI** and `jina-embeddings-v3`, `jina-clip-v2`, `jina-colbert-v2`, `jina-embeddings-v2-base-code`, `jina-embeddings-v2-base-zh`, `jina-embeddings-v2-base-en` from **Jina AI**.
- `input`: The text to convert
- `APERTIS_API_KEY`: Your API key

