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
    "gpt-4o",
    "gpt-4o-mini",
    "claude-sonnet-4-20250514",
    "gemini-2.5-pro",
    "deepseek-r1",
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
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `o1-preview`, `o3-mini` |
| Anthropic | `claude-sonnet-4-20250514`, `claude-opus-4-1-20250805` |
| Google | `gemini-2.5-pro`, `gemini-2.5-flash` |
| DeepSeek | `deepseek-r1`, `deepseek-v3`, `deepseek-chat` |
| xAI | `grok-3`, `grok-3-reasoning`, `grok-4` |
| Open Source | `llama-3.1-70b`, `mistral-large`, `qwen3-235b` |
| Embedding | `text-embedding-3-small`, `jina-embeddings-v3` |
| Image | `dall-e-3`, `gpt-image-1`, `gpt-image-1.5` |
| Audio | `whisper-1`, `tts-1` |

:::tip
Free-tier models are indicated with a `:free` suffix (e.g., `gemini-2.5-flash:free`, `deepseek-r1:free`).
:::

---

## OpenAI-Compatible Models API

```
GET /v1/models
```

Returns detailed model information in OpenAI-compatible format. This endpoint requires authentication.

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
      "id": "gpt-4o",
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
curl https://api.apertis.ai/v1/models/gpt-4o \
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
model = client.models.retrieve("gpt-4o")
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
const model = await client.models.retrieve('gpt-4o');
console.log(`Model: ${model.id}`);
```
