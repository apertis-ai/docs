# Responses API

```
POST /v1/responses
```

The Responses API is compatible with OpenAI's Responses API format, providing a streamlined interface for generating AI responses. This endpoint accepts the `input` field (instead of `messages`) and automatically converts it to the internal format.

:::info Input Format
The Responses API uses `input` instead of `messages`. You can provide either a string for simple queries or an array of message objects for conversations.
:::

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

## Authentication

| Header | Format | Example |
|--------|--------|---------|
| `Authorization` | Bearer token | `Authorization: Bearer sk-your-api-key` |

## Parameters

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | The model to use for generating the response |
| `input` | string/array | The input text or array of message objects |

### Optional Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `instructions` | string | High-level instructions for model behavior |
| `stream` | boolean | Enable streaming responses. Default: false |
| `temperature` | number | Sampling temperature (0-2). Default: 1 |
| `max_tokens` | integer | Maximum tokens in the response |
| `max_output_tokens` | integer | Upper bound for tokens including reasoning tokens |
| `tools` | array | List of tools the model can use (including web search) |
| `tool_choice` | string/object | Controls tool selection behavior |
| `max_tool_calls` | integer | Maximum number of tool calls allowed |
| `parallel_tool_calls` | boolean | Whether to allow parallel tool execution |
| `reasoning` | object | Reasoning configuration (see below) |
| `text` | object | Text output configuration (see below) |
| `store` | boolean | Whether to store the response for state management |
| `previous_response_id` | string | ID of previous response for multi-turn conversations |
| `truncation` | string | Context overflow handling (e.g., `"auto"`) |
| `metadata` | object | Request metadata (up to 16 key-value pairs) |

### Reasoning Parameter

The `reasoning` parameter configures the model's reasoning behavior:

| Option | Type | Description |
|--------|------|-------------|
| `effort` | string | Reasoning effort level: `low`, `medium`, `high` |
| `summary` | string | Summary style: `auto`, `concise`, `detailed` |

```python
response = client.responses.create(
    model="o1-preview",
    input="Solve this complex math problem...",
    reasoning={
        "effort": "high",
        "summary": "detailed"
    }
)
```

### Text Parameter

The `text` parameter configures text output:

| Option | Type | Description |
|--------|------|-------------|
| `format` | object | Output format configuration (e.g., `{"type": "json_object"}`) |
| `verbosity` | string | Output verbosity: `concise`, `normal`, `verbose` |

### Input Formats

**String Input** (simple query):
```json
{
  "model": "gpt-4o",
  "input": "What is the capital of France?"
}
```

**Array Input** (conversation):
```json
{
  "model": "gpt-4o",
  "input": [
    {"role": "user", "content": "Hello!"},
    {"role": "assistant", "content": "Hi there!"},
    {"role": "user", "content": "What's 2+2?"}
  ]
}
```

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

### With Web Search

Use the `tools` parameter to enable web search:

```python
response = client.responses.create(
    model="gpt-4o",
    input="What are the latest news about AI?",
    tools=[{"type": "web_search_preview"}]
)
```

### With Reasoning

```python
response = client.responses.create(
    model="o1-preview",
    input="Prove the Pythagorean theorem step by step.",
    reasoning={
        "effort": "high",
        "summary": "detailed"
    }
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

### Multi-turn Conversation

```python
response = client.responses.create(
    model="gpt-4o",
    input=[
        {"role": "user", "content": "What is Python?"},
        {"role": "assistant", "content": "Python is a high-level programming language..."},
        {"role": "user", "content": "How do I install it?"}
    ]
)
```

### With Instructions

Use `instructions` to provide high-level guidance for model behavior:

```python
response = client.responses.create(
    model="gpt-4o",
    instructions="You are a helpful coding assistant. Always provide code examples.",
    input="How do I read a file in Python?"
)
```

### Stateful Conversations

Use `store` and `previous_response_id` for multi-turn conversations with state:

```python
# First request - store the response
response1 = client.responses.create(
    model="gpt-4o",
    input="My name is Alice.",
    store=True
)

# Follow-up request - reference the previous response
response2 = client.responses.create(
    model="gpt-4o",
    input="What's my name?",
    previous_response_id=response1.id
)
```

### With Function Calling

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"}
                },
                "required": ["location"]
            }
        }
    }
]

response = client.responses.create(
    model="gpt-4o",
    input="What's the weather in Tokyo?",
    tools=tools,
    tool_choice="auto"
)
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

| Provider | Example Models |
|----------|---------------|
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `o1-preview`, `o1-mini` |
| Anthropic | `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229` |
| Google | `gemini-1.5-pro`, `gemini-1.5-flash`, `gemini-2.5-pro` |
| Meta | `llama-3.1-70b`, `llama-3.1-8b` |

## Differences from Chat Completions

| Feature | Responses API | Chat Completions |
|---------|--------------|------------------|
| Input field | `input` | `messages` |
| String input | Supported | Not supported |
| Instructions | `instructions` parameter | System message in `messages` |
| Reasoning config | `reasoning` object | `reasoning_effort` string |
| Text config | `text` object | Not available |
| State management | `store`, `previous_response_id` | Manual message array |
| Token limit | `max_output_tokens` | `max_tokens` |
| Tool call limits | `max_tool_calls`, `parallel_tool_calls` | Not available |
| Truncation | `truncation` parameter | Not available |

## Related Topics

- [Chat Completions](./chat_completions) - Traditional chat completion format
- [Messages API](./messages) - Anthropic-compatible format
- [Models](./models) - List available models
