# Models
```json
/v1/models
```

## List all models

Returns available models in OpenAI-compatible format. The response depends on your API key type:

- **Standard API key** (`sk-`): Returns all publicly available models
- **Subscription API key** (`sk-sub-`): Returns only models included in your subscription plan

### HTTP Request

```bash tab="cURL"
curl https://api.apertis.ai/v1/models \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>"
```

```python tab="Python"
from openai import OpenAI

client = OpenAI(
    api_key="<APERTIS_API_KEY>",
    base_url="https://api.apertis.ai/v1"
)

for model in client.models.list():
    print(model.id)
```

```javascript tab="JavaScript"
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: '<APERTIS_API_KEY>',
  baseURL: 'https://api.apertis.ai/v1'
});

for await (const model of client.models.list()) {
  console.log(model.id);
}
```

- `<APERTIS_API_KEY>`: Your API key

### Response (Standard Key)

```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-5.5",
      "object": "model",
      "created": 1626777600,
      "owned_by": "OpenAI",
      "root": "gpt-5.5",
      "parent": null
    }
  ]
}
```

### Catalogue fields

When the model catalogue has the information, each model in a standard-key response also carries these fields. A field with no value is left out of the model object.

```json
{
  "id": "gpt-5.5",
  "object": "model",
  "created": 1626777600,
  "owned_by": "OpenAI",
  "context_length": 400000,
  "pricing": {
    "charge_type": "Pay As You Go",
    "input_price": 0.00125,
    "output_price": 0.01,
    "currency": "USD"
  },
  "features": ["tool-calling", "vision"],
  "tasks": ["chat"]
}
```

| Field | Description |
|-------|-------------|
| `context_length` | Maximum context window size in tokens |
| `pricing.charge_type` | How the model is charged, for example `Pay As You Go` or `Pay Per Request` |
| `pricing.input_price` | For token-priced models: price per 1,000 input tokens, in `pricing.currency` |
| `pricing.output_price` | For token-priced models: price per 1,000 output tokens, in `pricing.currency` |
| `pricing.price_table` | For models priced per request: a list of `{ "spec", "price" }` entries, with a `resolution` where the price depends on one |
| `pricing.currency` | Always `USD` |
| `features` | Capabilities the catalogue lists for the model |
| `tasks` | Tasks the catalogue lists for the model |

The values above are illustrative. These fields are additive. The fields shown in the first response, such as `id` and `owned_by`, are unchanged, and standard OpenAI SDKs ignore the new ones.

### Response (Subscription Key)

When using a subscription API key, the response includes additional fields to help you understand quota costs:

```json
{
  "object": "list",
  "data": [
    {
      "id": "claude-sonnet-4-6",
      "object": "model",
      "created": 1626777600,
      "owned_by": "Anthropic",
      "root": "claude-sonnet-4-6",
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

> **Tip**
>
> These extra fields are ignored by standard OpenAI SDKs, so your existing code works without changes.

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

```bash tab="cURL"
curl https://api.apertis.ai/v1/models/gemini-2.5-flash-preview \
    -H "Authorization: Bearer <APERTIS_API_KEY>"
```

```python tab="Python"
from openai import OpenAI

client = OpenAI(
    api_key="<APERTIS_API_KEY>",
    base_url="https://api.apertis.ai/v1"
)

model = client.models.retrieve("gemini-2.5-flash-preview")
print(model.id, model.owned_by)
```

```javascript tab="JavaScript"
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: '<APERTIS_API_KEY>',
  baseURL: 'https://api.apertis.ai/v1'
});

const model = await client.models.retrieve('gemini-2.5-flash-preview');
console.log(model.id, model.owned_by);
```

### Response

Returns the model object if found. For a standard key, the object carries the same [catalogue fields](#catalogue-fields) as the list, when the catalogue has them. When using a subscription key, only models within your plan are accessible — requesting a model outside your plan returns a `model_not_found` error.

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
model = client.models.retrieve("claude-sonnet-4-6")
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
