# Chat Completion
```json
/v1/chat/completions
```

## HTTP Request

```bash
curl https://api.apertis.ai/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "<MODEL_ALIAS>",
        "messages": [
            {
                "role": "system",
                "content": "<MESSAGES>"
            }
        ]
    }'
```

- `<APERTIS_API_KEY>`: Your API key
- `<MODEL_ALIAS>`: The alias of the model to use
- `<MESSAGES>`: The messages to send to the model

## Optional Headers

| Header | Type | Description |
|--------|------|-------------|
| `X-Timeout` | integer | Total request timeout in milliseconds. Caps the entire request lifecycle including all channel retries. Range: 5,000–300,000 ms. Default: 60,000 ms (60s). See [Request Timeout](#request-timeout). |

## Optional Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `temperature` | number | Sampling temperature (0-2). Default: 1 |
| `max_tokens` | integer | Maximum tokens in the response |
| `top_p` | number | Nucleus sampling threshold (0-1) |
| `stream` | boolean | Enable streaming. Default: false |
| `compression` | object | [Context compression](./context-compression) configuration |

### Context Compression

Add a `compression` object to automatically summarize older conversation history and reduce token usage for long conversations:

```bash
curl https://api.apertis.ai/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "gpt-4.1-mini",
        "messages": [{"role": "user", "content": "Hello!"}],
        "compression": {"enabled": true, "model": "gpt-4.1-mini"}
    }'
```

See [Context Compression](./context-compression) for full documentation.

### Request Timeout

Use the `X-Timeout` header to limit the total time a request can take, including all internal channel retries. This prevents long waits when multiple upstream providers are slow or unavailable.

```bash
curl https://api.apertis.ai/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -H "X-Timeout: 20000" \
    -d '{
        "model": "gemini-3-flash-preview",
        "messages": [{"role": "user", "content": "Hello!"}]
    }'
```

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-apertis-key",
    base_url="https://api.apertis.ai/v1"
)

response = client.chat.completions.create(
    model="gemini-3-flash-preview",
    messages=[{"role": "user", "content": "Hello!"}],
    extra_headers={"X-Timeout": "20000"}  # 20 seconds
)
```

| Setting | Value |
|---------|-------|
| Default | 60,000 ms (60 seconds) |
| Minimum | 5,000 ms (5 seconds) |
| Maximum | 300,000 ms (5 minutes) |

When the timeout is exceeded, the API returns **HTTP 504** with diagnostic headers:

| Header | Description |
|--------|-------------|
| `X-Timeout-Attempts` | Number of upstream channels attempted |
| `X-Timeout-Elapsed-Ms` | Actual elapsed time in milliseconds |

```json
{
  "error": {
    "message": "Total request timeout (20000ms) exceeded after 3 channel attempts. Set X-Timeout header to adjust.",
    "type": "timeout",
    "code": "request_timeout"
  }
}
```

:::tip Streaming & Thinking Models
For streaming requests, the timeout only applies to the initial connection phase. Once the first response chunk arrives, the timer is stopped and the stream can run as long as needed. This ensures thinking models (e.g., `claude-opus-4-6`) are not interrupted mid-generation.
:::

See also: [Fallback Models](../utilities/fallback-models) for per-model fallback timeout configuration.

