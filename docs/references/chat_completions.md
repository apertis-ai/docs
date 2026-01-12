# Chat Completions API

```
POST /v1/chat/completions
```

The Chat Completions API is an **OpenAI-compatible endpoint** that provides unified access to multiple AI model providers. This endpoint follows the OpenAI API format, making it easy to integrate with existing applications.

:::info OpenAI Compatible
This endpoint is fully compatible with OpenAI's Chat Completions API format. You can use OpenAI SDKs directly with Apertis by changing the base URL.
:::

## HTTP Request

```bash
curl https://api.apertis.ai/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "user", "content": "Hello!"}
        ]
    }'
```

## Authentication

| Header | Format | Example |
|--------|--------|---------|
| `Authorization` | Bearer token | `Authorization: Bearer sk-your-api-key` |

## Parameters

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | ID of the model to use (e.g., `gpt-4o-mini`, `claude-3-5-sonnet-20241022`) |
| `messages` | array | Array of message objects in the conversation |

### Optional Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `temperature` | number | Sampling temperature (0-2). Higher values increase randomness. Default: 1 |
| `top_p` | number | Nucleus sampling threshold (0-1). Alternative to temperature sampling |
| `n` | integer | Number of chat completions to generate. Default: 1 |
| `stream` | boolean | Enable streaming responses. Default: false |
| `stop` | string/array | Up to 4 sequences where the API will stop generating |
| `max_tokens` | integer | Maximum tokens to generate in the response |
| `presence_penalty` | number | Penalize new topics (-2.0 to 2.0). Default: 0 |
| `frequency_penalty` | number | Penalize repetition (-2.0 to 2.0). Default: 0 |
| `logit_bias` | object | Map of token IDs to bias values (-100 to 100) |
| `user` | string | Unique identifier for end-user tracking |
| `response_format` | object | Specify output format (e.g., `{"type": "json_object"}` for JSON mode) |
| `seed` | integer | Seed for deterministic sampling |
| `tools` | array | List of tools/functions the model can call |
| `tool_choice` | string/object | Controls tool selection (`none`, `auto`, or specific tool) |

### Extended Parameters

These additional parameters are supported for upstream provider compatibility:

| Parameter | Type | Description |
|-----------|------|-------------|
| `extra_body` | object | Additional parameters for upstream providers (e.g., `enable_thinking`) |
| `top_k` | integer | Top-k sampling (provider-specific) |
| `reasoning_effort` | string | Controls reasoning model effort level (`low`, `medium`, `high`) |
| `stream_options` | object | Stream settings: `{ include_usage: boolean }` |
| `thinking` | object | Deep thinking control: `{ type: "enabled" \| "disabled" \| "auto" }` |
| `web_search_options` | object | Web search configuration for search-enabled models |

### Web Search Options

The `web_search_options` parameter enables web search for supported models:
- `gpt-5-search-api` - GPT-5 with web search capability
- `gpt-4o-search-preview` - GPT-4o with web search
- `gpt-4o-mini-search-preview` - GPT-4o Mini with web search

:::warning Web Search Models Only
The `web_search_options` parameter only works with the models listed above. Using it with other models will have no effect.
:::

| Option | Type | Description |
|--------|------|-------------|
| `search_context_size` | string | Amount of search context: `low`, `medium` (default), `high` |
| `user_location` | object | Geolocation for localized results |
| `filters` | array | Domain allow-list (up to 100 URLs, omit http/https prefix) |

#### search_context_size

Controls the amount of web search context included:
- `low` - Minimal context, faster responses
- `medium` - Balanced context (default)
- `high` - Maximum context, more comprehensive

#### user_location

Provides location context for localized search results:

```json
{
  "user_location": {
    "type": "approximate",
    "approximate": {
      "country": "US",
      "city": "San Francisco",
      "region": "California"
    }
  }
}
```

#### filters

Domain allow-list to restrict search results (up to 100 URLs):

```json
{
  "filters": ["openai.com", "github.com", "stackoverflow.com"]
}
```

:::tip
When specifying domains in filters, omit the HTTP/HTTPS prefix. Use `openai.com` instead of `https://openai.com/`. Subdomains are automatically included.
:::

### Web Search Example

```python
response = client.chat.completions.create(
    model="gpt-5-search-api",
    web_search_options={
        "search_context_size": "medium",
        "user_location": {
            "type": "approximate",
            "approximate": {
                "country": "US",
                "city": "San Francisco",
                "region": "California"
            }
        },
        "filters": ["reuters.com", "apnews.com"]
    },
    messages=[
        {"role": "user", "content": "What are today's top news headlines?"}
    ]
)
```

### Web Search Response

Responses from web search models include `url_citation` annotations with source references:

```json
{
  "choices": [{
    "message": {
      "content": "According to recent reports...",
      "annotations": [
        {
          "type": "url_citation",
          "start_index": 0,
          "end_index": 27,
          "url": "https://example.com/article",
          "title": "Article Title"
        }
      ]
    }
  }]
}
```

## Example Usage

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-api-key",
    base_url="https://api.apertis.ai/v1"
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "user", "content": "What is the meaning of life?"}
    ]
)

print(response.choices[0].message.content)
```

### JavaScript (OpenAI SDK)

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-api-key',
  baseURL: 'https://api.apertis.ai/v1'
});

const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'What is the meaning of life?' }
  ]
});

console.log(response.choices[0].message.content);
```

### With System Prompt

```python
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Tell me about the weather."}
    ]
)
```

### Multi-turn Conversation

```python
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "user", "content": "What is Python?"},
        {"role": "assistant", "content": "Python is a high-level programming language..."},
        {"role": "user", "content": "How do I install it?"}
    ]
)
```

### Streaming

```python
stream = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Write a poem about coding."}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### With All Parameters

```python
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Count 1 to 5"}],
    max_tokens=100,
    temperature=0.7,
    top_p=0.9,
    n=1,
    presence_penalty=0.1,
    frequency_penalty=0.1,
    logit_bias={"50256": -100},  # Discourage specific tokens
    user="user-123",
    seed=42,
    response_format={"type": "text"}
)
```

### Function Calling / Tools

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather in a location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City name"
                    }
                },
                "required": ["location"]
            }
        }
    }
]

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "What's the weather in Tokyo?"}],
    tools=tools,
    tool_choice="auto"
)
```

### Vision (Image Input)

Send images for analysis using multimodal models like GPT-4o or Claude:

```python
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "What do you see in this image?"
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "https://example.com/image.jpg"
                    }
                }
            ]
        }
    ]
)
```

#### With Base64 Encoded Image

```python
import base64

with open("image.png", "rb") as f:
    image_data = base64.standard_b64encode(f.read()).decode("utf-8")

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "Describe this image"
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/png;base64,{image_data}"
                    }
                }
            ]
        }
    ]
)
```

### Extended Thinking (Google Gemini)

Use `extra_body` to enable thinking features for Google Gemini models:

```python
response = client.chat.completions.create(
    model="gemini-2.5-pro",
    messages=[{"role": "user", "content": "Solve this step by step..."}],
    extra_body={
        "google": {
            "thinking_config": {
                "thinking_budget": 10240
            }
        }
    }
)
```

### Deterministic Output with Seed

```python
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Tell me a joke"}],
    seed=42,  # Same seed = reproducible output
    temperature=0.7
)
```

## Response Format

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1704067200,
  "model": "gpt-4o-mini-2024-07-18",
  "system_fingerprint": "fp_abc123",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 9,
    "completion_tokens": 10,
    "total_tokens": 19
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier for the completion |
| `object` | string | Object type, always `chat.completion` |
| `created` | integer | Unix timestamp when the response was generated |
| `model` | string | The model used for completion |
| `system_fingerprint` | string | Backend configuration identifier (when available) |
| `choices` | array | List of completion choices |
| `usage` | object | Token usage statistics |

### Choices Object

| Field | Type | Description |
|-------|------|-------------|
| `index` | integer | Index of this choice in the array |
| `message` | object | The assistant's message with `role` and `content` |
| `finish_reason` | string | Why the model stopped: `stop`, `length`, `tool_calls`, or `content_filter` |

### Usage Object

| Field | Type | Description |
|-------|------|-------------|
| `prompt_tokens` | integer | Tokens in the input prompt |
| `completion_tokens` | integer | Tokens in the generated response |
| `total_tokens` | integer | Total tokens used (prompt + completion) |

## Streaming Response

When `stream: true`, responses are sent as Server-Sent Events (SSE):

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1704067200,"model":"gpt-4o-mini","system_fingerprint":"fp_abc123","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1704067200,"model":"gpt-4o-mini","system_fingerprint":"fp_abc123","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1704067200,"model":"gpt-4o-mini","system_fingerprint":"fp_abc123","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1704067200,"model":"gpt-4o-mini","system_fingerprint":"fp_abc123","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":9,"completion_tokens":3,"total_tokens":12}}

data: [DONE]
```

:::tip Stream Options
Use `stream_options: { "include_usage": true }` to receive token usage in the final chunk.
:::

## Supported Models

The Chat Completions API supports models from multiple providers:

| Provider | Example Models |
|----------|---------------|
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo` |
| Anthropic | `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229`, `claude-3-haiku-20240307` |
| Google | `gemini-1.5-pro`, `gemini-1.5-flash` |
| Meta | `llama-3.1-70b`, `llama-3.1-8b` |
| And more... | Check the [Models](/references/models) endpoint for full list |

:::warning Responses-Only Models
Some advanced models **only** support the `/v1/responses` endpoint and cannot be used with `/v1/chat/completions`:

| Model | Description |
|-------|-------------|
| `gpt-5-pro` | GPT-5 Pro variant |
| `gpt-5-chat-latest` | Latest GPT-5 chat model |
| `gpt-5-mini` | GPT-5 Mini |
| `gpt-5-nano` | GPT-5 Nano |
| `gpt-5-codex-*` | GPT-5 Codex variants |
| `o1-pro` | O1 Pro |
| `codex-mini` | Codex Mini |

For these models, use the [Responses API](/references/responses) instead.
:::

## Error Responses

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid API key |
| 402 | Payment Required - Insufficient quota |
| 429 | Rate Limited - Too many requests |
| 500 | Internal Server Error |
| 503 | Service Unavailable - Model not available |

## Related Topics

- [Messages API](/references/messages) - Native Anthropic format
- [Responses API](/references/responses) - Alternative endpoint
- [Models](/references/models) - List available models
