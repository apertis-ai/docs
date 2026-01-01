# Responses API

```
POST /v1/responses
```

The Responses API is compatible with OpenAI's Responses API format, providing a streamlined interface for generating AI responses.

## HTTP Request

```bash
curl https://api.apertis.ai/v1/responses \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "gpt-4o",
        "input": "What is the capital of France?"
    }'
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | The model to use for generating the response |
| `input` | string or array | Yes | The input text or conversation to respond to |
| `instructions` | string | No | System instructions for the model |
| `temperature` | number | No | Sampling temperature (0-2). Default: 1 |
| `max_output_tokens` | integer | No | Maximum tokens in the response |
| `stream` | boolean | No | Enable streaming responses. Default: false |

## Example Usage

### Python

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-api-key",
    base_url="https://api.apertis.ai/v1"
)

response = client.responses.create(
    model="gpt-4o",
    input="Explain quantum computing in simple terms."
)

print(response.output_text)
```

### JavaScript

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-api-key',
  baseURL: 'https://api.apertis.ai/v1'
});

const response = await client.responses.create({
  model: 'gpt-4o',
  input: 'Explain quantum computing in simple terms.'
});

console.log(response.output_text);
```

### With Instructions

```python
response = client.responses.create(
    model="gpt-4o",
    instructions="You are a helpful coding assistant. Always provide code examples.",
    input="How do I read a file in Python?"
)
```

### Streaming

```python
stream = client.responses.create(
    model="gpt-4o",
    input="Write a short story about a robot.",
    stream=True
)

for event in stream:
    if event.type == "response.output_text.delta":
        print(event.delta, end="", flush=True)
```

## Response Format

```json
{
  "id": "resp_abc123",
  "object": "response",
  "created_at": 1699000000,
  "model": "gpt-4o",
  "output": [
    {
      "type": "message",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "The capital of France is Paris."
        }
      ]
    }
  ],
  "usage": {
    "input_tokens": 12,
    "output_tokens": 8,
    "total_tokens": 20
  }
}
```

## Supported Models

All chat models available through Apertis are supported with the Responses API:

- OpenAI models: `gpt-4o`, `gpt-4o-mini`, `o1-preview`, `o1-mini`, etc.
- Anthropic models: `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229`, etc.
- Google models: `gemini-1.5-pro`, `gemini-1.5-flash`, etc.
- Open source models: `llama-3.1-70b`, `mistral-large`, etc.

## Related Topics

- [Chat Completions](./chat_completions) - Traditional chat completion format
- [Messages API](./messages) - Anthropic-compatible format
- [Models](./models) - List available models
