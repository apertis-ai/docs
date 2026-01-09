# Messages API (Native Anthropic)

```
POST /v1/messages
```

The Messages API is a **native Anthropic endpoint** that routes directly to Anthropic-type channels. This endpoint uses the native Anthropic request/response format without any conversion, allowing you to use Anthropic SDKs directly with Apertis.

:::info Native Endpoint
This endpoint exclusively routes to Anthropic-type channels, ensuring full compatibility with Anthropic's API format including streaming, tool use, and all Claude-specific features.
:::

## HTTP Request

```bash
curl https://api.apertis.ai/v1/messages \
    -H "Content-Type: application/json" \
    -H "x-api-key: <APERTIS_API_KEY>" \
    -d '{
        "model": "claude-3-5-sonnet-20241022",
        "max_tokens": 1024,
        "messages": [
            {"role": "user", "content": "Hello, Claude!"}
        ]
    }'
```

:::note
The `anthropic-version` header is optional and will be ignored. Apertis handles API version compatibility automatically.
:::

## Authentication

The Messages API supports both authentication methods:

| Header | Format | Example |
|--------|--------|---------|
| `x-api-key` | Anthropic style | `x-api-key: sk-your-api-key` |
| `Authorization` | Bearer token | `Authorization: Bearer sk-your-api-key` |

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | The Claude model to use |
| `messages` | array | Yes | Array of message objects |
| `max_tokens` | integer | Yes | Maximum tokens in the response |
| `system` | string | No | System prompt |
| `temperature` | number | No | Sampling temperature (0-1). Default: 1 |
| `stream` | boolean | No | Enable streaming. Default: false |
| `stop_sequences` | array | No | Custom stop sequences |

## Example Usage

### Python (Anthropic SDK)

```python
import anthropic

client = anthropic.Anthropic(
    api_key="sk-your-api-key",
    base_url="https://api.apertis.ai"
)

message = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "What is the meaning of life?"}
    ]
)

print(message.content[0].text)
```

### JavaScript (Anthropic SDK)

```javascript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'sk-your-api-key',
  baseURL: 'https://api.apertis.ai'
});

const message = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'What is the meaning of life?' }
  ]
});

console.log(message.content[0].text);
```

### With System Prompt

```python
message = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    system="You are a helpful assistant that speaks like a pirate.",
    messages=[
        {"role": "user", "content": "Tell me about the weather."}
    ]
)
```

### Multi-turn Conversation

```python
message = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "What is Python?"},
        {"role": "assistant", "content": "Python is a high-level programming language..."},
        {"role": "user", "content": "How do I install it?"}
    ]
)
```

### Streaming

```python
with client.messages.stream(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Write a poem about coding."}]
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

### Streaming with curl

```bash
curl https://api.apertis.ai/v1/messages \
  -H "x-api-key: <APERTIS_API_KEY>" \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-opus-4-5-20251101",
    "max_tokens": 100,
    "stream": true,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

SSE events returned:
- `message_start` - Initial message metadata
- `content_block_start` - Start of content block
- `content_block_delta` - Incremental text chunks
- `content_block_stop` - End of content block
- `message_delta` - Final usage and stop reason
- `message_stop` - Stream complete

### Vision (Image Input)

```python
import base64

with open("image.png", "rb") as f:
    image_data = base64.standard_b64encode(f.read()).decode("utf-8")

message = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": image_data
                    }
                },
                {
                    "type": "text",
                    "text": "What do you see in this image?"
                }
            ]
        }
    ]
)
```

## Response Format

```json
{
  "id": "msg_abc123",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello! How can I help you today?"
    }
  ],
  "model": "claude-3-5-sonnet-20241022",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 12,
    "output_tokens": 10
  }
}
```

## Supported Models

The Messages API supports Claude models via Anthropic-type channels:

| Model | Description |
|-------|-------------|
| `claude-opus-4-5-20251101` | Claude Opus 4.5 - most capable |
| `claude-sonnet-4-20250514` | Claude Sonnet 4 - balanced |
| `claude-3-5-sonnet-20241022` | Claude 3.5 Sonnet - fast and capable |
| `claude-3-opus-20240229` | Claude 3 Opus |
| `claude-3-sonnet-20240229` | Claude 3 Sonnet |
| `claude-3-haiku-20240307` | Claude 3 Haiku - fast and efficient |

:::warning Anthropic Channels Only
This endpoint routes exclusively to Anthropic-type channels. If you need to access non-Claude models, use the [Chat Completions](./chat_completions) endpoint instead.
:::

## Differences from Direct Anthropic API

| Feature | Apertis | Direct Anthropic |
|---------|---------|------------------|
| Base URL | `https://api.apertis.ai` | `https://api.anthropic.com` |
| API Key | Apertis API key | Anthropic API key |
| Request Format | Native Anthropic (no conversion) | Native Anthropic |
| Streaming | Full SSE support | Full SSE support |
| Billing | Unified Apertis billing | Anthropic billing |

## Related Topics

- [Chat Completions](./chat_completions) - OpenAI-compatible format
- [Responses API](./responses) - OpenAI Responses format
- [Models](./models) - List available models
