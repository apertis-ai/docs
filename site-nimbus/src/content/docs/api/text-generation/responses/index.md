---
title: "Responses API"
---

# Responses API

```
POST /v1/responses
```

The Responses API is compatible with OpenAI's Responses API format, providing a streamlined interface for generating AI responses. This endpoint accepts the `input` field (instead of `messages`) and automatically converts it to the internal format.

<aside class="admonition admonition-info">
<p class="admonition-title">Input Format</p>

The Responses API uses `input` instead of `messages`. You can provide either a string for simple queries or an array of message objects for conversations.

</aside>

## HTTP Request


<div class="code-tabs">
<div class="code-tabs__list" role="tablist" aria-label="Code samples" data-pagefind-ignore hidden><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-1-0" aria-controls="code-tabs-1-0-panel" aria-selected="true" tabindex="0">cURL</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-1-1" aria-controls="code-tabs-1-1-panel" aria-selected="false" tabindex="-1">Python</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-1-2" aria-controls="code-tabs-1-2-panel" aria-selected="false" tabindex="-1">JavaScript</button></div>
<div class="code-tabs__panel" id="code-tabs-1-0-panel" data-tab="cURL">
<p class="code-tabs__label" data-pagefind-ignore>cURL</p>

```bash
curl https://api.apertis.ai/v1/responses \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "gpt-5.2",
        "input": "What is the capital of France?"
    }'
```

</div>
<div class="code-tabs__panel" id="code-tabs-1-1-panel" data-tab="Python">
<p class="code-tabs__label" data-pagefind-ignore>Python</p>

```python
from openai import OpenAI

client = OpenAI(
    api_key="<APERTIS_API_KEY>",
    base_url="https://api.apertis.ai/v1"
)

response = client.responses.create(
    model="gpt-5.2",
    input="What is the capital of France?"
)

print(response.output_text)
```

</div>
<div class="code-tabs__panel" id="code-tabs-1-2-panel" data-tab="JavaScript">
<p class="code-tabs__label" data-pagefind-ignore>JavaScript</p>

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: '<APERTIS_API_KEY>',
  baseURL: 'https://api.apertis.ai/v1'
});

const response = await client.responses.create({
  model: 'gpt-5.2',
  input: 'What is the capital of France?'
});

console.log(response.output_text);
```

</div>
<script>__apertisCodeTabs(document.currentScript.parentNode)</script>
</div>


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


<div class="code-tabs">
<div class="code-tabs__list" role="tablist" aria-label="Code samples" data-pagefind-ignore hidden><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-2-0" aria-controls="code-tabs-2-0-panel" aria-selected="true" tabindex="0">cURL</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-2-1" aria-controls="code-tabs-2-1-panel" aria-selected="false" tabindex="-1">Python</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-2-2" aria-controls="code-tabs-2-2-panel" aria-selected="false" tabindex="-1">JavaScript</button></div>
<div class="code-tabs__panel" id="code-tabs-2-0-panel" data-tab="cURL">
<p class="code-tabs__label" data-pagefind-ignore>cURL</p>

```bash
curl https://api.apertis.ai/v1/responses \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "gpt-5.2",
        "input": "Solve this complex math problem...",
        "reasoning": {"effort": "high", "summary": "detailed"}
    }'
```

</div>
<div class="code-tabs__panel" id="code-tabs-2-1-panel" data-tab="Python">
<p class="code-tabs__label" data-pagefind-ignore>Python</p>

```python
response = client.responses.create(
    model="gpt-5.2",
    input="Solve this complex math problem...",
    reasoning={
        "effort": "high",
        "summary": "detailed"
    }
)
```

</div>
<div class="code-tabs__panel" id="code-tabs-2-2-panel" data-tab="JavaScript">
<p class="code-tabs__label" data-pagefind-ignore>JavaScript</p>

```javascript
const response = await client.responses.create({
  model: 'gpt-5.2',
  input: 'Solve this complex math problem...',
  reasoning: {
    effort: 'high',
    summary: 'detailed'
  }
});
```

</div>
<script>__apertisCodeTabs(document.currentScript.parentNode)</script>
</div>


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
  "model": "gpt-4.1",
  "input": "What is the capital of France?"
}
```

**Array Input** (conversation):
```json
{
  "model": "gpt-4.1",
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
    model="gpt-4.1",
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
  model: 'gpt-4.1',
  input: 'Explain quantum computing in simple terms.'
});

console.log(response.output_text);
```

### With Web Search

Use the `tools` parameter to enable web search:


<div class="code-tabs">
<div class="code-tabs__list" role="tablist" aria-label="Code samples" data-pagefind-ignore hidden><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-3-0" aria-controls="code-tabs-3-0-panel" aria-selected="true" tabindex="0">cURL</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-3-1" aria-controls="code-tabs-3-1-panel" aria-selected="false" tabindex="-1">Python</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-3-2" aria-controls="code-tabs-3-2-panel" aria-selected="false" tabindex="-1">JavaScript</button></div>
<div class="code-tabs__panel" id="code-tabs-3-0-panel" data-tab="cURL">
<p class="code-tabs__label" data-pagefind-ignore>cURL</p>

```bash
curl https://api.apertis.ai/v1/responses \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "gpt-5.2",
        "input": "What are the latest news about AI?",
        "tools": [{"type": "web_search_preview"}]
    }'
```

</div>
<div class="code-tabs__panel" id="code-tabs-3-1-panel" data-tab="Python">
<p class="code-tabs__label" data-pagefind-ignore>Python</p>

```python
response = client.responses.create(
    model="gpt-5.2",
    input="What are the latest news about AI?",
    tools=[{"type": "web_search_preview"}]
)
```

</div>
<div class="code-tabs__panel" id="code-tabs-3-2-panel" data-tab="JavaScript">
<p class="code-tabs__label" data-pagefind-ignore>JavaScript</p>

```javascript
const response = await client.responses.create({
  model: 'gpt-5.2',
  input: 'What are the latest news about AI?',
  tools: [{ type: 'web_search_preview' }]
});
```

</div>
<script>__apertisCodeTabs(document.currentScript.parentNode)</script>
</div>


### With Reasoning


<div class="code-tabs">
<div class="code-tabs__list" role="tablist" aria-label="Code samples" data-pagefind-ignore hidden><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-4-0" aria-controls="code-tabs-4-0-panel" aria-selected="true" tabindex="0">cURL</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-4-1" aria-controls="code-tabs-4-1-panel" aria-selected="false" tabindex="-1">Python</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-4-2" aria-controls="code-tabs-4-2-panel" aria-selected="false" tabindex="-1">JavaScript</button></div>
<div class="code-tabs__panel" id="code-tabs-4-0-panel" data-tab="cURL">
<p class="code-tabs__label" data-pagefind-ignore>cURL</p>

```bash
curl https://api.apertis.ai/v1/responses \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "gpt-5.2",
        "input": "Prove the Pythagorean theorem step by step.",
        "reasoning": {"effort": "high", "summary": "detailed"}
    }'
```

</div>
<div class="code-tabs__panel" id="code-tabs-4-1-panel" data-tab="Python">
<p class="code-tabs__label" data-pagefind-ignore>Python</p>

```python
response = client.responses.create(
    model="gpt-5.2",
    input="Prove the Pythagorean theorem step by step.",
    reasoning={
        "effort": "high",
        "summary": "detailed"
    }
)
```

</div>
<div class="code-tabs__panel" id="code-tabs-4-2-panel" data-tab="JavaScript">
<p class="code-tabs__label" data-pagefind-ignore>JavaScript</p>

```javascript
const response = await client.responses.create({
  model: 'gpt-5.2',
  input: 'Prove the Pythagorean theorem step by step.',
  reasoning: {
    effort: 'high',
    summary: 'detailed'
  }
});
```

</div>
<script>__apertisCodeTabs(document.currentScript.parentNode)</script>
</div>


### Streaming


<div class="code-tabs">
<div class="code-tabs__list" role="tablist" aria-label="Code samples" data-pagefind-ignore hidden><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-5-0" aria-controls="code-tabs-5-0-panel" aria-selected="true" tabindex="0">cURL</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-5-1" aria-controls="code-tabs-5-1-panel" aria-selected="false" tabindex="-1">Python</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-5-2" aria-controls="code-tabs-5-2-panel" aria-selected="false" tabindex="-1">JavaScript</button></div>
<div class="code-tabs__panel" id="code-tabs-5-0-panel" data-tab="cURL">
<p class="code-tabs__label" data-pagefind-ignore>cURL</p>

```bash
curl https://api.apertis.ai/v1/responses \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "gpt-5.2",
        "input": "Write a short story about a robot.",
        "stream": true
    }'
```

</div>
<div class="code-tabs__panel" id="code-tabs-5-1-panel" data-tab="Python">
<p class="code-tabs__label" data-pagefind-ignore>Python</p>

```python
stream = client.responses.create(
    model="gpt-5.2",
    input="Write a short story about a robot.",
    stream=True
)

for event in stream:
    if event.type == "response.output_text.delta":
        print(event.delta, end="", flush=True)
```

</div>
<div class="code-tabs__panel" id="code-tabs-5-2-panel" data-tab="JavaScript">
<p class="code-tabs__label" data-pagefind-ignore>JavaScript</p>

```javascript
const stream = await client.responses.create({
  model: 'gpt-5.2',
  input: 'Write a short story about a robot.',
  stream: true
});

for await (const event of stream) {
  if (event.type === 'response.output_text.delta') process.stdout.write(event.delta);
}
```

</div>
<script>__apertisCodeTabs(document.currentScript.parentNode)</script>
</div>


### Multi-turn Conversation


<div class="code-tabs">
<div class="code-tabs__list" role="tablist" aria-label="Code samples" data-pagefind-ignore hidden><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-6-0" aria-controls="code-tabs-6-0-panel" aria-selected="true" tabindex="0">cURL</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-6-1" aria-controls="code-tabs-6-1-panel" aria-selected="false" tabindex="-1">Python</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-6-2" aria-controls="code-tabs-6-2-panel" aria-selected="false" tabindex="-1">JavaScript</button></div>
<div class="code-tabs__panel" id="code-tabs-6-0-panel" data-tab="cURL">
<p class="code-tabs__label" data-pagefind-ignore>cURL</p>

```bash
curl https://api.apertis.ai/v1/responses \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "gpt-5.2",
        "input": [
            {"role": "user", "content": "What is Python?"},
            {"role": "assistant", "content": "Python is a high-level programming language..."},
            {"role": "user", "content": "How do I install it?"}
        ]
    }'
```

</div>
<div class="code-tabs__panel" id="code-tabs-6-1-panel" data-tab="Python">
<p class="code-tabs__label" data-pagefind-ignore>Python</p>

```python
response = client.responses.create(
    model="gpt-5.2",
    input=[
        {"role": "user", "content": "What is Python?"},
        {"role": "assistant", "content": "Python is a high-level programming language..."},
        {"role": "user", "content": "How do I install it?"}
    ]
)
```

</div>
<div class="code-tabs__panel" id="code-tabs-6-2-panel" data-tab="JavaScript">
<p class="code-tabs__label" data-pagefind-ignore>JavaScript</p>

```javascript
const response = await client.responses.create({
  model: 'gpt-5.2',
  input: [
    { role: 'user', content: 'What is Python?' },
    { role: 'assistant', content: 'Python is a high-level programming language...' },
    { role: 'user', content: 'How do I install it?' }
  ]
});
```

</div>
<script>__apertisCodeTabs(document.currentScript.parentNode)</script>
</div>


### With Instructions

Use `instructions` to provide high-level guidance for model behavior:


<div class="code-tabs">
<div class="code-tabs__list" role="tablist" aria-label="Code samples" data-pagefind-ignore hidden><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-7-0" aria-controls="code-tabs-7-0-panel" aria-selected="true" tabindex="0">cURL</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-7-1" aria-controls="code-tabs-7-1-panel" aria-selected="false" tabindex="-1">Python</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-7-2" aria-controls="code-tabs-7-2-panel" aria-selected="false" tabindex="-1">JavaScript</button></div>
<div class="code-tabs__panel" id="code-tabs-7-0-panel" data-tab="cURL">
<p class="code-tabs__label" data-pagefind-ignore>cURL</p>

```bash
curl https://api.apertis.ai/v1/responses \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "gpt-5.2",
        "instructions": "You are a helpful coding assistant. Always provide code examples.",
        "input": "How do I read a file in Python?"
    }'
```

</div>
<div class="code-tabs__panel" id="code-tabs-7-1-panel" data-tab="Python">
<p class="code-tabs__label" data-pagefind-ignore>Python</p>

```python
response = client.responses.create(
    model="gpt-5.2",
    instructions="You are a helpful coding assistant. Always provide code examples.",
    input="How do I read a file in Python?"
)
```

</div>
<div class="code-tabs__panel" id="code-tabs-7-2-panel" data-tab="JavaScript">
<p class="code-tabs__label" data-pagefind-ignore>JavaScript</p>

```javascript
const response = await client.responses.create({
  model: 'gpt-5.2',
  instructions: 'You are a helpful coding assistant. Always provide code examples.',
  input: 'How do I read a file in Python?'
});
```

</div>
<script>__apertisCodeTabs(document.currentScript.parentNode)</script>
</div>


### Stateful Conversations

Use `store` and `previous_response_id` for multi-turn conversations with state:


<div class="code-tabs">
<div class="code-tabs__list" role="tablist" aria-label="Code samples" data-pagefind-ignore hidden><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-8-0" aria-controls="code-tabs-8-0-panel" aria-selected="true" tabindex="0">cURL</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-8-1" aria-controls="code-tabs-8-1-panel" aria-selected="false" tabindex="-1">Python</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-8-2" aria-controls="code-tabs-8-2-panel" aria-selected="false" tabindex="-1">JavaScript</button></div>
<div class="code-tabs__panel" id="code-tabs-8-0-panel" data-tab="cURL">
<p class="code-tabs__label" data-pagefind-ignore>cURL</p>

```bash
curl https://api.apertis.ai/v1/responses \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "gpt-5.2",
        "input": "My name is Alice.",
        "store": true
    }'

# Follow-up request - reference the previous response
curl https://api.apertis.ai/v1/responses \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "gpt-5.2",
        "input": "What is my name?",
        "previous_response_id": "<RESPONSE_ID>"
    }'
```

</div>
<div class="code-tabs__panel" id="code-tabs-8-1-panel" data-tab="Python">
<p class="code-tabs__label" data-pagefind-ignore>Python</p>

```python
# First request - store the response
response1 = client.responses.create(
    model="gpt-5.2",
    input="My name is Alice.",
    store=True
)

# Follow-up request - reference the previous response
response2 = client.responses.create(
    model="gpt-5.2",
    input="What's my name?",
    previous_response_id=response1.id
)
```

</div>
<div class="code-tabs__panel" id="code-tabs-8-2-panel" data-tab="JavaScript">
<p class="code-tabs__label" data-pagefind-ignore>JavaScript</p>

```javascript
// First request - store the response
const response1 = await client.responses.create({
  model: 'gpt-5.2',
  input: 'My name is Alice.',
  store: true
});

// Follow-up request - reference the previous response
const response2 = await client.responses.create({
  model: 'gpt-5.2',
  input: "What's my name?",
  previous_response_id: response1.id
});
```

</div>
<script>__apertisCodeTabs(document.currentScript.parentNode)</script>
</div>


### With Function Calling


<div class="code-tabs">
<div class="code-tabs__list" role="tablist" aria-label="Code samples" data-pagefind-ignore hidden><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-9-0" aria-controls="code-tabs-9-0-panel" aria-selected="true" tabindex="0">cURL</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-9-1" aria-controls="code-tabs-9-1-panel" aria-selected="false" tabindex="-1">Python</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-9-2" aria-controls="code-tabs-9-2-panel" aria-selected="false" tabindex="-1">JavaScript</button></div>
<div class="code-tabs__panel" id="code-tabs-9-0-panel" data-tab="cURL">
<p class="code-tabs__label" data-pagefind-ignore>cURL</p>

```bash
curl https://api.apertis.ai/v1/responses \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "gpt-5.2",
        "input": "What is the weather in Tokyo?",
        "tools": [
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
        ],
        "tool_choice": "auto"
    }'
```

</div>
<div class="code-tabs__panel" id="code-tabs-9-1-panel" data-tab="Python">
<p class="code-tabs__label" data-pagefind-ignore>Python</p>

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
    model="gpt-5.2",
    input="What's the weather in Tokyo?",
    tools=tools,
    tool_choice="auto"
)
```

</div>
<div class="code-tabs__panel" id="code-tabs-9-2-panel" data-tab="JavaScript">
<p class="code-tabs__label" data-pagefind-ignore>JavaScript</p>

```javascript
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get the current weather',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' }
        },
        required: ['location']
      }
    }
  }
];

const response = await client.responses.create({
  model: 'gpt-5.2',
  input: "What's the weather in Tokyo?",
  tools,
  tool_choice: 'auto'
});
```

</div>
<script>__apertisCodeTabs(document.currentScript.parentNode)</script>
</div>


## Response Format

```json
{
  "id": "resp_abc123",
  "object": "response",
  "created_at": 1699000000,
  "model": "gpt-4.1",
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

All chat models available through Apertis are supported with the Responses API. The API intelligently routes requests based on model capabilities:

### Models with Native /v1/responses Support

These models natively support the Responses API format on upstream providers:

| Model Series | Examples |
|-------------|----------|
| **o1 Series** | `o1`, `o1-preview`, `o4-mini`, `o1-2024-12-17` |
| **o3 Series** | `o3`, `o3-mini`, `o3-2025-04-16` |
| **o4 Series** | `o4-mini`, `o4-mini-2025-04-16` |
| **GPT-5 Series** | `gpt-5`, `gpt-5.1`, `gpt-5.2`, `gpt-5-*` |
| **Codex Models** | `gpt-5-codex`, `gpt-5-codex-*` |

### Responses-Only Models

Some advanced models **only** support the `/v1/responses` endpoint and cannot be used with `/v1/chat/completions` or `/v1/messages`:

| Model | Description |
|-------|-------------|
| `gpt-5-pro` | GPT-5 Pro variant |
| `gpt-5-chat-latest` | Latest GPT-5 chat model |
| `gpt-5-mini` | GPT-5 Mini |
| `gpt-5-nano` | GPT-5 Nano |
| `gpt-5-codex-*` | GPT-5 Codex variants |
| `o1-pro` | O1 Pro |
| `codex-mini` | Codex Mini |

<aside class="admonition admonition-warning">
<p class="admonition-title">Responses-Only Models</p>

When using responses-only models, you must use the `/v1/responses` endpoint. Requests to `/v1/chat/completions` or `/v1/messages` will return an error for these models.

</aside>

### All Other Models

For models that don't natively support `/v1/responses` (like Claude, Gemini, GPT-4o, etc.), Apertis automatically:

1. Routes the request via `/v1/chat/completions` internally
2. Converts the response back to Responses API format
3. Returns the response in the expected format

This means you can use **any model** with the Responses API - the conversion is handled transparently.

| Provider | Example Models | Native Support |
|----------|---------------|----------------|
| OpenAI | `gpt-4.1`, `gpt-4.1-mini` | Via fallback |
| Anthropic | `claude-sonnet-4.5`, `claude-opus-4` | Via fallback |
| Google | `gemini-3-pro-preview`, `gemini-3-flash-preview` | Via fallback |
| Meta | `llama-3.1-70b`, `llama-3.1-8b` | Via fallback |
| xAI | `grok-3`, `grok-3-reasoning` | Via fallback |

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

## Context Compression

The Responses API supports [context compression](/api/text-generation/context-compression) to automatically reduce token usage for long conversations. Enable it via the request body or HTTP headers:


<div class="code-tabs">
<div class="code-tabs__list" role="tablist" aria-label="Code samples" data-pagefind-ignore hidden><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-10-0" aria-controls="code-tabs-10-0-panel" aria-selected="true" tabindex="0">cURL</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-10-1" aria-controls="code-tabs-10-1-panel" aria-selected="false" tabindex="-1">Python</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-10-2" aria-controls="code-tabs-10-2-panel" aria-selected="false" tabindex="-1">JavaScript</button></div>
<div class="code-tabs__panel" id="code-tabs-10-0-panel" data-tab="cURL">
<p class="code-tabs__label" data-pagefind-ignore>cURL</p>

```bash
curl https://api.apertis.ai/v1/responses \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "gpt-5.2",
        "input": [
            {"role": "user", "content": "Explain distributed systems"},
            {"role": "assistant", "content": "Distributed systems are..."},
            {"role": "user", "content": "Summarize the key points"}
        ],
        "compression": {"enabled": true, "strategy": "on", "model": "gemini-3-flash-preview"}
    }'
```

</div>
<div class="code-tabs__panel" id="code-tabs-10-1-panel" data-tab="Python">
<p class="code-tabs__label" data-pagefind-ignore>Python</p>

```python
response = client.responses.create(
    model="gpt-5.2",
    input=[
        {"role": "user", "content": "Explain distributed systems"},
        {"role": "assistant", "content": "Distributed systems are..."},
        # ... long conversation history ...
        {"role": "user", "content": "Summarize the key points"}
    ],
    extra_body={
        "compression": {
            "enabled": True,
            "strategy": "on",
            "model": "gemini-3-flash-preview"
        }
    }
)
```

</div>
<div class="code-tabs__panel" id="code-tabs-10-2-panel" data-tab="JavaScript">
<p class="code-tabs__label" data-pagefind-ignore>JavaScript</p>

```javascript
const response = await client.responses.create({
  model: 'gpt-5.2',
  input: [
    { role: 'user', content: 'Explain distributed systems' },
    { role: 'assistant', content: 'Distributed systems are...' },
    // ... long conversation history ...
    { role: 'user', content: 'Summarize the key points' }
  ],
  compression: {
    enabled: true,
    strategy: 'on',
    model: 'gemini-3-flash-preview'
  }
});
```

</div>
<script>__apertisCodeTabs(document.currentScript.parentNode)</script>
</div>


See [Context Compression](/api/text-generation/context-compression) for full configuration options and strategies.

## Related Topics

- [Chat Completions](/api/text-generation/chat-completions) - Traditional chat completion format
- [Messages API](/api/text-generation/messages) - Anthropic-compatible format
- [Context Compression](/api/text-generation/context-compression) - Reduce token usage for long conversations
- [Models](/api/utilities/models) - List available models
