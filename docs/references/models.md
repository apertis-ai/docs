# Models

```
GET /api/models
```

Returns a simple list of all available model IDs. This endpoint is useful for quickly retrieving all model identifiers without detailed model information.

### HTTP Request

```bash
curl https://api.apertis.ai/api/models
```

:::note
This endpoint does not require authentication.
:::

### Response Format

```json
{
  "data": [
    "gpt-4o",
    "gpt-4o-mini",
    "claude-3-5-sonnet-20241022",
    "gemini-1.5-pro",
    ...
  ],
  "success": true
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `data` | array | List of all available model IDs |
| `success` | boolean | Indicates if the request was successful |

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

### Model Categories

The response includes models from various categories:

| Category | Examples |
|----------|----------|
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `o1-preview` |
| Anthropic | `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229` |
| Google | `gemini-1.5-pro`, `gemini-1.5-flash` |
| Open Source | `llama-3.1-70b`, `mistral-large` |
| Embedding | `text-embedding-3-small`, `jina-embeddings-v3` |
| Image | `dall-e-3`, `gpt-image-1` |
| Audio | `whisper-1`, `tts-1` |

:::tip
Free-tier models are indicated with a `:free` suffix (e.g., `gemini-1.5-flash:free`).
:::
