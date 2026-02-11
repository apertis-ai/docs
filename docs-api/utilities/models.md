# Models
```json
/v1/models
```

## List all models

Returns available models in OpenAI-compatible format. The response depends on your API key type:

- **Standard API key** (`sk-`): Returns all publicly available models
- **Subscription API key** (`sk-sub-`): Returns only models included in your subscription plan

### HTTP Request

```bash
curl https://api.apertis.ai/v1/models \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>"
```

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

:::tip
These extra fields are ignored by standard OpenAI SDKs, so your existing code works without changes.
:::

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

```bash
curl https://api.apertis.ai/v1/models/claude-sonnet-4.5 \
    -H "Authorization: Bearer <APERTIS_API_KEY>"
```

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
