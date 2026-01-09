# Messages API (Anthropic Format)

```
POST /v1/messages
```

The Messages API provides compatibility with Anthropic's native API format, allowing you to use Anthropic SDKs directly with Apertis.

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

The Messages API supports all Claude models:

| Model | Description |
|-------|-------------|
| `claude-3-5-sonnet-20241022` | Latest Sonnet - balanced performance |
| `claude-3-opus-20240229` | Most capable Claude model |
| `claude-3-sonnet-20240229` | Previous generation Sonnet |
| `claude-3-haiku-20240307` | Fast and efficient |

:::tip
You can also use non-Claude models through this endpoint. The request will be automatically translated to the appropriate format.
:::

## Differences from Direct Anthropic API

| Feature | Apertis | Direct Anthropic |
|---------|---------|------------------|
| Base URL | `https://api.apertis.ai` | `https://api.anthropic.com` |
| API Key | Apertis API key | Anthropic API key |
| Model Access | All models via single key | Claude models only |
| Billing | Unified Apertis billing | Anthropic billing |

## Related Topics

- [Chat Completions](./chat_completions) - OpenAI-compatible format
- [Responses API](./responses) - OpenAI Responses format
- [Models](./models) - List available models
