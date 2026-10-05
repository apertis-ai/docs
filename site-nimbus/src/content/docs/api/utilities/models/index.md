---
title: "Models"
---

# Models
```json
/v1/models
```

## List all models

Returns available models in OpenAI-compatible format. The response depends on your API key type:

- **Standard API key** (`sk-`): Returns all publicly available models
- **Subscription API key** (`sk-sub-`): Returns only models included in your subscription plan

### HTTP Request


<div class="code-tabs">
<div class="code-tabs__list" role="tablist" aria-label="Code samples" data-pagefind-ignore hidden><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-1-0" aria-controls="code-tabs-1-0-panel" aria-selected="true" tabindex="0">cURL</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-1-1" aria-controls="code-tabs-1-1-panel" aria-selected="false" tabindex="-1">Python</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-1-2" aria-controls="code-tabs-1-2-panel" aria-selected="false" tabindex="-1">JavaScript</button></div>
<div class="code-tabs__panel" id="code-tabs-1-0-panel" data-tab="cURL">
<p class="code-tabs__label" data-pagefind-ignore>cURL</p>

```bash
curl https://api.apertis.ai/v1/models \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>"
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

for model in client.models.list():
    print(model.id)
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

for await (const model of client.models.list()) {
  console.log(model.id);
}
```

</div>
<script>__apertisCodeTabs(document.currentScript.parentNode)</script>
</div>


- `<APERTIS_API_KEY>`: Your API key

### Response (Standard Key)

```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-4.1",
      "object": "model",
      "created": 1626777600,
      "owned_by": "OpenAI",
      "root": "gpt-4.1",
      "parent": null
    }
  ]
}
```

### Response (Subscription Key)

When using a subscription API key, the response includes additional fields to help you understand quota costs:

```json
{
  "object": "list",
  "data": [
    {
      "id": "claude-sonnet-4.5",
      "object": "model",
      "created": 1626777600,
      "owned_by": "Anthropic",
      "root": "claude-sonnet-4.5",
      "parent": null,
      "multiplier": 2.1,
      "tier": "pro",
      "context_length": 1000000
    },
    {
      "id": "gemini-2.5-flash-preview",
      "object": "model",
      "created": 1626777600,
      "owned_by": "Google",
      "root": "gemini-2.5-flash-preview",
      "parent": null,
      "multiplier": 0,
      "tier": "free"
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `multiplier` | Quota cost multiplier. `0` means the model is free and does not consume quota |
| `tier` | The plan tier where this model originates (`free`, `lite`, `pro`, `max`) |
| `context_length` | Maximum context window size in tokens (when available) |

<aside class="admonition admonition-tip">
<p class="admonition-title">Tip</p>

These extra fields are ignored by standard OpenAI SDKs, so your existing code works without changes.

</aside>

### Plan Model Access

Models are organized by tier with inheritance — higher-tier plans include all models from lower tiers:

| Plan | Accessible Models |
|------|-------------------|
| **Lite** | Lite + Free models |
| **Pro** | Pro + Lite + Free models |
| **Max** | Max + Pro + Lite + Free models |

## Retrieve a model

Returns details for a single model.

### HTTP Request


<div class="code-tabs">
<div class="code-tabs__list" role="tablist" aria-label="Code samples" data-pagefind-ignore hidden><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-2-0" aria-controls="code-tabs-2-0-panel" aria-selected="true" tabindex="0">cURL</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-2-1" aria-controls="code-tabs-2-1-panel" aria-selected="false" tabindex="-1">Python</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-2-2" aria-controls="code-tabs-2-2-panel" aria-selected="false" tabindex="-1">JavaScript</button></div>
<div class="code-tabs__panel" id="code-tabs-2-0-panel" data-tab="cURL">
<p class="code-tabs__label" data-pagefind-ignore>cURL</p>

```bash
curl https://api.apertis.ai/v1/models/gemini-2.5-flash-preview \
    -H "Authorization: Bearer <APERTIS_API_KEY>"
```

</div>
<div class="code-tabs__panel" id="code-tabs-2-1-panel" data-tab="Python">
<p class="code-tabs__label" data-pagefind-ignore>Python</p>

```python
from openai import OpenAI

client = OpenAI(
    api_key="<APERTIS_API_KEY>",
    base_url="https://api.apertis.ai/v1"
)

model = client.models.retrieve("gemini-2.5-flash-preview")
print(model.id, model.owned_by)
```

</div>
<div class="code-tabs__panel" id="code-tabs-2-2-panel" data-tab="JavaScript">
<p class="code-tabs__label" data-pagefind-ignore>JavaScript</p>

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: '<APERTIS_API_KEY>',
  baseURL: 'https://api.apertis.ai/v1'
});

const model = await client.models.retrieve('gemini-2.5-flash-preview');
console.log(model.id, model.owned_by);
```

</div>
<script>__apertisCodeTabs(document.currentScript.parentNode)</script>
</div>


### Response

Returns the model object if found. When using a subscription key, only models within your plan are accessible — requesting a model outside your plan returns a `model_not_found` error.

### Python Example

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-sub-your-subscription-key",
    base_url="https://api.apertis.ai/v1"
)

# List models available in your plan
models = client.models.list()
for model in models:
    print(model.id)

# Retrieve a specific model
model = client.models.retrieve("claude-sonnet-4.5")
print(model.id, model.owned_by)
```

### Node.js Example

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-sub-your-subscription-key',
  baseURL: 'https://api.apertis.ai/v1'
});

// List models available in your plan
const models = await client.models.list();
for await (const model of models) {
  console.log(model.id);
}
```
