---
title: "Embedding API"
---

# Embedding API

Apertis provides the Embedding API for developers to convert text into vectors and find similar text through vector search.

## Usage (Example in Python)


<div class="code-tabs">
<div class="code-tabs__list" role="tablist" aria-label="Code samples" data-pagefind-ignore hidden><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-1-0" aria-controls="code-tabs-1-0-panel" aria-selected="true" tabindex="0">cURL</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-1-1" aria-controls="code-tabs-1-1-panel" aria-selected="false" tabindex="-1">Python</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-1-2" aria-controls="code-tabs-1-2-panel" aria-selected="false" tabindex="-1">JavaScript</button></div>
<div class="code-tabs__panel" id="code-tabs-1-0-panel" data-tab="cURL">
<p class="code-tabs__label" data-pagefind-ignore>cURL</p>

```bash
curl https://api.apertis.ai/v1/embeddings \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "jina-embeddings-v3",
        "input": "The food was delicious and the waiter..."
    }'
```

</div>
<div class="code-tabs__panel" id="code-tabs-1-1-panel" data-tab="Python">
<p class="code-tabs__label" data-pagefind-ignore>Python</p>

```python
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

</div>
<div class="code-tabs__panel" id="code-tabs-1-2-panel" data-tab="JavaScript">
<p class="code-tabs__label" data-pagefind-ignore>JavaScript</p>

```javascript
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

</div>
<script>__apertisCodeTabs(document.currentScript.parentNode)</script>
</div>


## Parameters

- `model`: The model to use, currently supports `text-embedding-3-large`, `text-embedding-3-small`, `text-embedding-ada-002` from **OpenAI** and `jina-embeddings-v3`, `jina-clip-v2`, `jina-colbert-v2`, `jina-embeddings-v2-base-code`, `jina-embeddings-v2-base-zh`, `jina-embeddings-v2-base-en` from **Jina AI**.
- `input`: The text to convert
- `APERTIS_API_KEY`: Your API key
