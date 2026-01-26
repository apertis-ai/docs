# Models

## Public Models List

```
GET /api/models
```

Returns a simple list of all available model IDs. This endpoint is publicly accessible and useful for quickly retrieving all supported model identifiers without authentication.

### HTTP Request

```bash
curl https://api.apertis.ai/api/models
```

:::note
This endpoint does **not** require authentication and is publicly accessible.
:::

### Response Format

```json
{
  "data": [
    "gpt-4.1",
    "gpt-4.1-mini",
    "claude-sonnet-4.5",
    "gemini-3-pro-preview",
    "deepseek-r1-0528",
    "gpt-image-1.5",
    ...
  ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `data` | array | List of all available model IDs (450+ models) |

### Example Usage

**Python:**
```python
import requests

response = requests.get("https://api.apertis.ai/api/models")
models = response.json()

print(f"Available models: {len(models['data'])}")
for model_id in models['data'][:10]:  # Print first 10
    print(f"  - {model_id}")
```

**JavaScript:**
```javascript
const response = await fetch('https://api.apertis.ai/api/models');
const models = await response.json();

console.log(`Available models: ${models.data.length}`);
models.data.slice(0, 10).forEach(id => console.log(`  - ${id}`));
```

**cURL:**
```bash
curl -s https://api.apertis.ai/api/models | jq '.data | length'
# Output: 457
```

### Model Categories

The response includes models from various providers and categories:

| Category | Examples |
|----------|----------|
| OpenAI | `gpt-4.1`, `gpt-4.1-mini`, `o1-preview`, `o3-mini` |
| Anthropic | `claude-sonnet-4.5`, `claude-opus-4-5-20251101`, `claude-haiku-4.5` |
| Google | `gemini-3-pro-preview`, `gemini-3-flash-preview` |
| DeepSeek | `deepseek-r1-0528`, `deepseek-v3.2` |
| xAI | `grok-3`, `grok-3-reasoning`, `grok-4` |
| Open Source | `llama-3.1-70b`, `mistral-large`, `qwen3-235b` |
| Embedding | `text-embedding-3-small`, `jina-embeddings-v3` |
| Image | `dall-e-3`, `gpt-image-1`, `gpt-image-1.5` |
| Audio | `whisper-1`, `tts-1` |

:::tip
Free-tier models are indicated with a `:free` suffix (e.g., `gemini-3-flash-preview:free`, `deepseek-r1-0528:free`).
:::

### Endpoint Compatibility

Different models support different API endpoints. Apertis provides automatic fallback routing so you can use any endpoint with most models.

#### Endpoint Support Matrix

| Endpoint | Supported Models | Fallback Behavior |
|----------|-----------------|-------------------|
| `/v1/chat/completions` | Most models | Native support |
| `/v1/messages` | All models | Claude → native Anthropic; Others → via chat/completions |
| `/v1/responses` | All models | o1/o3/o4/gpt-5 → native; Others → via chat/completions |

#### Responses-Only Models

These models **only** support `/v1/responses` and cannot be used with other endpoints:

| Model | Description |
|-------|-------------|
| `gpt-5-pro` | GPT-5 Pro variant |
| `gpt-5-chat-latest` | Latest GPT-5 chat model |
| `gpt-5-mini` | GPT-5 Mini |
| `gpt-5-nano` | GPT-5 Nano |
| `gpt-5-codex-*` | GPT-5 Codex variants |
| `o1-pro` | O1 Pro |
| `codex-mini` | Codex Mini |

:::warning
Attempting to use responses-only models with `/v1/chat/completions` or `/v1/messages` will result in an error. Use `/v1/responses` instead.
:::

#### Models with Native /v1/responses Support

These models support `/v1/responses` natively (no conversion needed):

- **o1 Series**: `o1`, `o1-pro`, `o1-2024-12-17`
- **o3 Series**: `o3`, `o3-pro`, `o3-2025-04-16`
- **o4 Series**: `o4-mini`, `o4-mini-high`, `o4-mini-2025-04-16`
- **GPT-5 Series**: `gpt-5`, `gpt-5.1`, `gpt-5.2`, `gpt-5-*`

---

## OpenAI-Compatible Models API

```
GET /v1/models
```

Returns all public models in OpenAI-compatible format. This endpoint requires authentication but returns the same model list as `/api/models`.

### HTTP Request

```bash
curl https://api.apertis.ai/v1/models \
  -H "Authorization: Bearer <APERTIS_API_KEY>"
```

### Response Format

```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-4.1",
      "object": "model",
      "created": 1626777600,
      "owned_by": "openai",
      "permission": [...]
    },
    ...
  ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `object` | string | Always `"list"` |
| `data` | array | Array of model objects |
| `data[].id` | string | The model identifier |
| `data[].object` | string | Always `"model"` |
| `data[].created` | integer | Unix timestamp of model creation |
| `data[].owned_by` | string | Organization that owns the model |

### Get Specific Model

```
GET /v1/models/{model}
```

Retrieve information about a specific model.

```bash
curl https://api.apertis.ai/v1/models/gpt-4.1 \
  -H "Authorization: Bearer <APERTIS_API_KEY>"
```

### Example Usage

**Python (OpenAI SDK):**
```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-api-key",
    base_url="https://api.apertis.ai/v1"
)

# List all models
models = client.models.list()
for model in models.data[:10]:
    print(f"{model.id} - owned by {model.owned_by}")

# Get specific model
model = client.models.retrieve("gpt-4.1")
print(f"Model: {model.id}")
```

**JavaScript (OpenAI SDK):**
```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-api-key',
  baseURL: 'https://api.apertis.ai/v1'
});

// List all models
const models = await client.models.list();
for (const model of models.data.slice(0, 10)) {
  console.log(`${model.id} - owned by ${model.owned_by}`);
}

// Get specific model
const model = await client.models.retrieve('gpt-4.1');
console.log(`Model: ${model.id}`);
```
