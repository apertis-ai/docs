---
title: "Messages API (Native Anthropic)"
---

# Messages API (Native Anthropic)

```
POST /v1/messages
```

The Messages API is a **native Anthropic endpoint** that routes directly to Anthropic-type channels. This endpoint uses the native Anthropic request/response format without any conversion, allowing you to use Anthropic SDKs directly with Apertis.

<aside class="admonition admonition-info">
<p class="admonition-title">Native Endpoint</p>

This endpoint exclusively routes to Anthropic-type channels, ensuring full compatibility with Anthropic's API format including streaming, tool use, and all Claude-specific features.

</aside>

## HTTP Request


<div class="code-tabs">
<div class="code-tabs__list" role="tablist" aria-label="Code samples" data-pagefind-ignore hidden><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-1-0" aria-controls="code-tabs-1-0-panel" aria-selected="true" tabindex="0">cURL</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-1-1" aria-controls="code-tabs-1-1-panel" aria-selected="false" tabindex="-1">Python</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-1-2" aria-controls="code-tabs-1-2-panel" aria-selected="false" tabindex="-1">TypeScript</button></div>
<div class="code-tabs__panel" id="code-tabs-1-0-panel" data-tab="cURL">
<p class="code-tabs__label" data-pagefind-ignore>cURL</p>

```bash
curl https://api.apertis.ai/v1/messages \
    -H "Content-Type: application/json" \
    -H "x-api-key: <APERTIS_API_KEY>" \
    -d '{
        "model": "claude-opus-4-5-20251101",
        "max_tokens": 1024,
        "messages": [
            {"role": "user", "content": "Hello, Claude!"}
        ]
    }'
```

</div>
<div class="code-tabs__panel" id="code-tabs-1-1-panel" data-tab="Python">
<p class="code-tabs__label" data-pagefind-ignore>Python</p>

```python
import anthropic

client = anthropic.Anthropic(
    api_key="<APERTIS_API_KEY>",
    base_url="https://api.apertis.ai"
)

message = client.messages.create(
    model="claude-opus-4-5-20251101",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello, Claude!"}
    ]
)

print(message.content[0].text)
```

</div>
<div class="code-tabs__panel" id="code-tabs-1-2-panel" data-tab="TypeScript">
<p class="code-tabs__label" data-pagefind-ignore>TypeScript</p>

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: '<APERTIS_API_KEY>',
  baseURL: 'https://api.apertis.ai'
});

const message: Anthropic.Message = await client.messages.create({
  model: 'claude-opus-4-5-20251101',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'Hello, Claude!' }
  ]
});

const block = message.content[0];
if (block.type === 'text') console.log(block.text);
```

</div>
<script>__apertisCodeTabs(document.currentScript.parentNode)</script>
</div>


<aside class="admonition admonition-note">
<p class="admonition-title">Note</p>

The `anthropic-version` header is optional and will be ignored. Apertis handles API version compatibility automatically.

</aside>

## Authentication

The Messages API supports both authentication methods:

| Header | Format | Example |
|--------|--------|---------|
| `x-api-key` | Anthropic style | `x-api-key: sk-your-api-key` |
| `Authorization` | Bearer token | `Authorization: Bearer sk-your-api-key` |

## Parameters

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | The Claude model to use |
| `messages` | array | Array of message objects |
| `max_tokens` | integer | Maximum tokens in the response |

### Optional Parameters (Native Anthropic)

| Parameter | Type | Description |
|-----------|------|-------------|
| `system` | string | System prompt (top-level, not in messages) |
| `temperature` | number | Sampling temperature (0-1). Default: 1 |
| `top_p` | number | Nucleus sampling threshold (0-1) |
| `top_k` | integer | Top-k sampling (Anthropic specific) |
| `stream` | boolean | Enable streaming. Default: false |
| `stop_sequences` | array | Custom stop sequences |
| `tools` | array | Tools/functions the model can call |
| `tool_choice` | object | Controls tool selection behavior |
| `metadata` | object | Request metadata (e.g., user_id) |
| `thinking` | object | Extended thinking configuration (see below) |

### Thinking Parameter

The `thinking` parameter enables Claude's extended thinking capability for more complex reasoning:

| Option | Type | Description |
|--------|------|-------------|
| `type` | string | `"enabled"` or `"disabled"` |
| `budget_tokens` | integer | Token budget for thinking (1024-32768) |


<div class="code-tabs">
<div class="code-tabs__list" role="tablist" aria-label="Code samples" data-pagefind-ignore hidden><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-2-0" aria-controls="code-tabs-2-0-panel" aria-selected="true" tabindex="0">cURL</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-2-1" aria-controls="code-tabs-2-1-panel" aria-selected="false" tabindex="-1">Python</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-2-2" aria-controls="code-tabs-2-2-panel" aria-selected="false" tabindex="-1">TypeScript</button></div>
<div class="code-tabs__panel" id="code-tabs-2-0-panel" data-tab="cURL">
<p class="code-tabs__label" data-pagefind-ignore>cURL</p>

```bash
curl https://api.apertis.ai/v1/messages \
    -H "Content-Type: application/json" \
    -H "x-api-key: <APERTIS_API_KEY>" \
    -d '{
        "model": "claude-opus-4-5-20251101",
        "max_tokens": 4096,
        "thinking": {"type": "enabled", "budget_tokens": 10240},
        "messages": [
            {"role": "user", "content": "Solve this complex math problem step by step..."}
        ]
    }'
```

</div>
<div class="code-tabs__panel" id="code-tabs-2-1-panel" data-tab="Python">
<p class="code-tabs__label" data-pagefind-ignore>Python</p>

```python
# Extended Thinking Example
message = client.messages.create(
    model="claude-opus-4-5-20251101",
    max_tokens=4096,
    thinking={
        "type": "enabled",
        "budget_tokens": 10240
    },
    messages=[
        {"role": "user", "content": "Solve this complex math problem step by step..."}
    ]
)
```

</div>
<div class="code-tabs__panel" id="code-tabs-2-2-panel" data-tab="TypeScript">
<p class="code-tabs__label" data-pagefind-ignore>TypeScript</p>

```typescript
// Extended Thinking Example
const message = await client.messages.create({
  model: 'claude-opus-4-5-20251101',
  max_tokens: 4096,
  thinking: {
    type: 'enabled',
    budget_tokens: 10240
  },
  messages: [
    { role: 'user', content: 'Solve this complex math problem step by step...' }
  ]
});
```

</div>
<script>__apertisCodeTabs(document.currentScript.parentNode)</script>
</div>


### Extended Parameters (OpenAI-compatible)

These additional parameters are supported for compatibility with upstream providers:

| Parameter | Type | Description |
|-----------|------|-------------|
| `n` | integer | Number of completions to generate. Default: 1 |
| `stop` | string/array | Up to 4 sequences where the API will stop generating |
| `presence_penalty` | number | Penalize new topics (-2.0 to 2.0). Default: 0 |
| `frequency_penalty` | number | Penalize repetition (-2.0 to 2.0). Default: 0 |
| `logit_bias` | object | Map of token IDs to bias values (-100 to 100) |
| `user` | string | Unique identifier for end-user tracking |
| `response_format` | object | Specify output format (e.g., JSON mode) |
| `seed` | number | Seed for deterministic sampling |

## Example Usage

### Python (Anthropic SDK)

```python
import anthropic

client = anthropic.Anthropic(
    api_key="sk-your-api-key",
    base_url="https://api.apertis.ai"
)

message = client.messages.create(
    model="claude-sonnet-4.5",
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
  model: 'claude-sonnet-4.5',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'What is the meaning of life?' }
  ]
});

console.log(message.content[0].text);
```

### With System Prompt


<div class="code-tabs">
<div class="code-tabs__list" role="tablist" aria-label="Code samples" data-pagefind-ignore hidden><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-3-0" aria-controls="code-tabs-3-0-panel" aria-selected="true" tabindex="0">cURL</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-3-1" aria-controls="code-tabs-3-1-panel" aria-selected="false" tabindex="-1">Python</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-3-2" aria-controls="code-tabs-3-2-panel" aria-selected="false" tabindex="-1">TypeScript</button></div>
<div class="code-tabs__panel" id="code-tabs-3-0-panel" data-tab="cURL">
<p class="code-tabs__label" data-pagefind-ignore>cURL</p>

```bash
curl https://api.apertis.ai/v1/messages \
    -H "Content-Type: application/json" \
    -H "x-api-key: <APERTIS_API_KEY>" \
    -d '{
        "model": "claude-opus-4-5-20251101",
        "max_tokens": 1024,
        "system": "You are a helpful assistant that speaks like a pirate.",
        "messages": [
            {"role": "user", "content": "Tell me about the weather."}
        ]
    }'
```

</div>
<div class="code-tabs__panel" id="code-tabs-3-1-panel" data-tab="Python">
<p class="code-tabs__label" data-pagefind-ignore>Python</p>

```python
message = client.messages.create(
    model="claude-opus-4-5-20251101",
    max_tokens=1024,
    system="You are a helpful assistant that speaks like a pirate.",
    messages=[
        {"role": "user", "content": "Tell me about the weather."}
    ]
)
```

</div>
<div class="code-tabs__panel" id="code-tabs-3-2-panel" data-tab="TypeScript">
<p class="code-tabs__label" data-pagefind-ignore>TypeScript</p>

```typescript
const message = await client.messages.create({
  model: 'claude-opus-4-5-20251101',
  max_tokens: 1024,
  system: 'You are a helpful assistant that speaks like a pirate.',
  messages: [
    { role: 'user', content: 'Tell me about the weather.' }
  ]
});
```

</div>
<script>__apertisCodeTabs(document.currentScript.parentNode)</script>
</div>


### Multi-turn Conversation


<div class="code-tabs">
<div class="code-tabs__list" role="tablist" aria-label="Code samples" data-pagefind-ignore hidden><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-4-0" aria-controls="code-tabs-4-0-panel" aria-selected="true" tabindex="0">cURL</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-4-1" aria-controls="code-tabs-4-1-panel" aria-selected="false" tabindex="-1">Python</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-4-2" aria-controls="code-tabs-4-2-panel" aria-selected="false" tabindex="-1">TypeScript</button></div>
<div class="code-tabs__panel" id="code-tabs-4-0-panel" data-tab="cURL">
<p class="code-tabs__label" data-pagefind-ignore>cURL</p>

```bash
curl https://api.apertis.ai/v1/messages \
    -H "Content-Type: application/json" \
    -H "x-api-key: <APERTIS_API_KEY>" \
    -d '{
        "model": "claude-opus-4-5-20251101",
        "max_tokens": 1024,
        "messages": [
            {"role": "user", "content": "What is Python?"},
            {"role": "assistant", "content": "Python is a high-level programming language..."},
            {"role": "user", "content": "How do I install it?"}
        ]
    }'
```

</div>
<div class="code-tabs__panel" id="code-tabs-4-1-panel" data-tab="Python">
<p class="code-tabs__label" data-pagefind-ignore>Python</p>

```python
message = client.messages.create(
    model="claude-opus-4-5-20251101",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "What is Python?"},
        {"role": "assistant", "content": "Python is a high-level programming language..."},
        {"role": "user", "content": "How do I install it?"}
    ]
)
```

</div>
<div class="code-tabs__panel" id="code-tabs-4-2-panel" data-tab="TypeScript">
<p class="code-tabs__label" data-pagefind-ignore>TypeScript</p>

```typescript
const message = await client.messages.create({
  model: 'claude-opus-4-5-20251101',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'What is Python?' },
    { role: 'assistant', content: 'Python is a high-level programming language...' },
    { role: 'user', content: 'How do I install it?' }
  ]
});
```

</div>
<script>__apertisCodeTabs(document.currentScript.parentNode)</script>
</div>


### Streaming

```python
with client.messages.stream(
    model="claude-sonnet-4.5",
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


<div class="code-tabs">
<div class="code-tabs__list" role="tablist" aria-label="Code samples" data-pagefind-ignore hidden><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-5-0" aria-controls="code-tabs-5-0-panel" aria-selected="true" tabindex="0">cURL</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-5-1" aria-controls="code-tabs-5-1-panel" aria-selected="false" tabindex="-1">Python</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-5-2" aria-controls="code-tabs-5-2-panel" aria-selected="false" tabindex="-1">TypeScript</button></div>
<div class="code-tabs__panel" id="code-tabs-5-0-panel" data-tab="cURL">
<p class="code-tabs__label" data-pagefind-ignore>cURL</p>

```bash
curl https://api.apertis.ai/v1/messages \
    -H "Content-Type: application/json" \
    -H "x-api-key: <APERTIS_API_KEY>" \
    -d '{
        "model": "claude-opus-4-5-20251101",
        "max_tokens": 1024,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": "image/png", "data": "<BASE64_IMAGE_DATA>"}
                    },
                    {"type": "text", "text": "What do you see in this image?"}
                ]
            }
        ]
    }'
```

</div>
<div class="code-tabs__panel" id="code-tabs-5-1-panel" data-tab="Python">
<p class="code-tabs__label" data-pagefind-ignore>Python</p>

```python
import base64

with open("image.png", "rb") as f:
    image_data = base64.standard_b64encode(f.read()).decode("utf-8")

message = client.messages.create(
    model="claude-opus-4-5-20251101",
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

</div>
<div class="code-tabs__panel" id="code-tabs-5-2-panel" data-tab="TypeScript">
<p class="code-tabs__label" data-pagefind-ignore>TypeScript</p>

```typescript
import fs from 'node:fs';

const imageData = fs.readFileSync('image.png').toString('base64');

const message = await client.messages.create({
  model: 'claude-opus-4-5-20251101',
  max_tokens: 1024,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: imageData
          }
        },
        {
          type: 'text',
          text: 'What do you see in this image?'
        }
      ]
    }
  ]
});
```

</div>
<script>__apertisCodeTabs(document.currentScript.parentNode)</script>
</div>


### PDF Document Input

Claude can analyze PDF documents directly. Use the `document` content type with base64-encoded PDF data:


<div class="code-tabs">
<div class="code-tabs__list" role="tablist" aria-label="Code samples" data-pagefind-ignore hidden><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-6-0" aria-controls="code-tabs-6-0-panel" aria-selected="true" tabindex="0">cURL</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-6-1" aria-controls="code-tabs-6-1-panel" aria-selected="false" tabindex="-1">Python</button><button type="button" role="tab" class="code-tabs__tab" id="code-tabs-6-2" aria-controls="code-tabs-6-2-panel" aria-selected="false" tabindex="-1">TypeScript</button></div>
<div class="code-tabs__panel" id="code-tabs-6-0-panel" data-tab="cURL">
<p class="code-tabs__label" data-pagefind-ignore>cURL</p>

```bash
curl https://api.apertis.ai/v1/messages \
    -H "Content-Type: application/json" \
    -H "x-api-key: <APERTIS_API_KEY>" \
    -d '{
        "model": "claude-opus-4-5-20251101",
        "max_tokens": 4096,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {"type": "base64", "media_type": "application/pdf", "data": "<BASE64_PDF_DATA>"}
                    },
                    {"type": "text", "text": "Summarize this document."}
                ]
            }
        ]
    }'
```

</div>
<div class="code-tabs__panel" id="code-tabs-6-1-panel" data-tab="Python">
<p class="code-tabs__label" data-pagefind-ignore>Python</p>

```python
import base64

with open("document.pdf", "rb") as f:
    pdf_data = base64.standard_b64encode(f.read()).decode("utf-8")

message = client.messages.create(
    model="claude-opus-4-5-20251101",
    max_tokens=4096,
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": pdf_data
                    }
                },
                {
                    "type": "text",
                    "text": "Summarize this document."
                }
            ]
        }
    ]
)
```

</div>
<div class="code-tabs__panel" id="code-tabs-6-2-panel" data-tab="TypeScript">
<p class="code-tabs__label" data-pagefind-ignore>TypeScript</p>

```typescript
import fs from 'node:fs';

const pdfData = fs.readFileSync('document.pdf').toString('base64');

const message = await client.messages.create({
  model: 'claude-opus-4-5-20251101',
  max_tokens: 4096,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: pdfData
          }
        },
        {
          type: 'text',
          text: 'Summarize this document.'
        }
      ]
    }
  ]
});
```

</div>
<script>__apertisCodeTabs(document.currentScript.parentNode)</script>
</div>


#### Document Source Options

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"base64"` for encoded data |
| `media_type` | string | `"application/pdf"` for PDF files |
| `data` | string | Base64-encoded document content |

<aside class="admonition admonition-tip">
<p class="admonition-title">Supported Formats</p>

Currently, PDF (`application/pdf`) is the primary supported document format for Claude models.

</aside>

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
  "model": "claude-sonnet-4.5",
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
| `claude-sonnet-4.5` | Claude Sonnet 4.5 - balanced |
| `claude-haiku-4.5` | Claude Haiku 4.5 - fast and efficient |

<aside class="admonition admonition-warning">
<p class="admonition-title">Anthropic Channels Only</p>

This endpoint routes exclusively to Anthropic-type channels. If you need to access non-Claude models, use the [Chat Completions](/api/text-generation/chat-completions) endpoint instead.

Note: Some advanced OpenAI models (like `gpt-5-pro`, `o1-pro`, `gpt-5-codex-*`) only support the [Responses API](/api/text-generation/responses) and cannot be used with this endpoint.

</aside>

## Differences from Direct Anthropic API

| Feature | Apertis | Direct Anthropic |
|---------|---------|------------------|
| Base URL | `https://api.apertis.ai` | `https://api.anthropic.com` |
| API Key | Apertis API key | Anthropic API key |
| Request Format | Native Anthropic (no conversion) | Native Anthropic |
| Streaming | Full SSE support | Full SSE support |
| Billing | Unified Apertis billing | Anthropic billing |

## Context Compression

The Messages API supports [context compression](/api/text-generation/context-compression) to automatically summarize older conversation history and reduce token usage.

### Using the Anthropic SDK

```python
message = client.messages.create(
    model="claude-sonnet-4.5",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello!"}
    ],
    extra_body={
        "compression": {
            "enabled": True,
            "strategy": "on",
            "model": "gpt-4.1-mini"
        }
    }
)
```

### Using cURL

```bash
curl https://api.apertis.ai/v1/messages \
  -H "x-api-key: <APERTIS_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4.5",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello!"}],
    "compression": {"enabled": true, "model": "gpt-4.1-mini"}
  }'
```

See [Context Compression](/api/text-generation/context-compression) for full documentation including strategies, configuration, and response headers.

## Related Topics

- [Chat Completions](/api/text-generation/chat-completions) - OpenAI-compatible format
- [Responses API](/api/text-generation/responses) - OpenAI Responses format
- [Context Compression](/api/text-generation/context-compression) - Reduce token usage for long conversations
- [Models](/api/utilities/models) - List available models
