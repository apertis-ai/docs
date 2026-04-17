# Recommend

```json
/v1/recommend
```

## Dynamic model recommendation

Returns an opinionated, task-aware model recommendation with live pricing. Use this endpoint when building coding agents or automations that should pick the right model at runtime instead of hard-coding a model ID.

The recommendation always reflects current platform pricing and model availability, so the returned `model` can be used directly in subsequent API calls.

### HTTP Request

```bash
curl "https://api.apertis.ai/v1/recommend?task=coding&budget=medium" \
    -H "Authorization: Bearer <APERTIS_API_KEY>"
```

- `<APERTIS_API_KEY>`: Your API key

### Query Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `task` | Yes | One of `coding`, `long-context`, `fast-chat`, `reasoning`, `vision` |
| `budget` | No | One of `low`, `medium`, `high`. Defaults to `medium` |

**Task types**

- `coding` — Multi-file edits, debugging, code review, architecture
- `long-context` — Large codebases, long documents, multi-file reasoning
- `fast-chat` — Customer support, simple Q&A, chat workloads
- `reasoning` — Math, logic, structured problem solving
- `vision` — Images, diagrams, screenshots, UI understanding

**Budget tiers**

- `low` — Cheapest valid candidate for the task
- `medium` — Editorial pick (first curated candidate); the best balance of quality and cost
- `high` — Most capable candidate, regardless of price

### Response

```json
{
  "model": "claude-sonnet-4-6",
  "task": "coding",
  "budget": "medium",
  "input_price_per_1m": 2.40,
  "output_price_per_1m": 12.00,
  "reason": "Best coding ability per dollar. 200K context.",
  "alternatives": [
    {
      "model": "deepseek-v3",
      "input_price_per_1m": 0.30,
      "note": "3x cheaper, good for simpler coding tasks"
    },
    {
      "model": "gpt-4o",
      "input_price_per_1m": 1.88,
      "note": "reliable, mid-range cost"
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `model` | The recommended model ID. Use this directly in `/v1/chat/completions`, `/v1/messages`, etc. |
| `task` | Echoes the requested task type |
| `budget` | Echoes the applied budget (`medium` if unspecified) |
| `input_price_per_1m` | Current input price in USD per 1M tokens |
| `output_price_per_1m` | Current output price in USD per 1M tokens |
| `reason` | Short rationale for the pick |
| `alternatives[]` | Up to 2 other candidates for the same task, with price and a usage note |

### Error responses

| Status | Condition |
|--------|-----------|
| `400` | Missing or invalid `task`, or invalid `budget` value |
| `401` | Missing or invalid API key |
| `503` | No candidate models available for this task (rare — indicates upstream pricing misconfiguration) |

### Usage example (Python)

```python
import os
import requests
from openai import OpenAI

# Step 1: ask Apertis what to use
rec = requests.get(
    "https://api.apertis.ai/v1/recommend",
    params={"task": "coding", "budget": "medium"},
    headers={"Authorization": f"Bearer {os.environ['APERTIS_API_KEY']}"},
).json()

# Step 2: use the returned model ID directly
client = OpenAI(
    base_url="https://api.apertis.ai/v1",
    api_key=os.environ["APERTIS_API_KEY"],
)
response = client.chat.completions.create(
    model=rec["model"],
    messages=[{"role": "user", "content": "Refactor this function..."}],
)
```

:::tip
Pair `budget=low` with cost-sensitive background jobs and `budget=high` with user-facing interactive tasks where quality matters most. `medium` is tuned for the default case and mirrors the curated recommendations in the [Apertis Model Picker skill](https://github.com/apertis-ai/apertis-skills).
:::
