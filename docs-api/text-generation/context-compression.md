# Context Compression

```
POST /v1/chat/completions
POST /v1/messages
```

Context compression automatically summarizes older conversation history to reduce token usage and cost, while preserving recent context. This is especially useful for long-running conversations where token counts grow significantly.

## How It Works

When enabled, Apertis analyzes the conversation before forwarding it to the target model:

1. **Token threshold check** — Compression only triggers when the conversation exceeds a configurable token threshold
2. **Message segmentation** — Messages are split into system prompts, compressible history, and recent turns (which are always preserved)
3. **Cost-effectiveness check** — Compression is skipped if the cost of running the compression model exceeds the estimated savings
4. **Summarization** — Older messages are summarized by a lightweight model (e.g., `gpt-4o-mini` or `claude-3-5-haiku-latest`)
5. **Injection** — The summary replaces the older messages, and recent turns are preserved verbatim

:::info Transparent to Your Application
Compression happens at the gateway level. Your application sends the full conversation as usual — Apertis handles compression automatically and returns the response as normal. The only visible difference is reduced token usage.
:::

## Enabling Compression

There are three ways to enable context compression, with the following priority order:

**Request body** > **Request headers** > **Token-level defaults**

### Method 1: Request Body (Recommended for SDKs)

Add a `compression` object to your request body. This works with the OpenAI SDK via `extra_body` and with the Anthropic SDK via `extra_body`.

#### OpenAI SDK (Python)

```python
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="https://api.apertis.ai/v1"
)

response = client.chat.completions.create(
    model="gpt-4.1-mini",
    messages=[
        {"role": "user", "content": "Hello!"}
    ],
    extra_body={
        "compression": {
            "enabled": True,
            "strategy": "on",         # "on", "conservative", or "aggressive"
            "threshold": 8000,         # Token threshold to trigger compression
            "keep_turns": 6,           # Recent turns to always preserve
            "model": "auto"            # Compression model ("auto" or specific model)
        }
    }
)

print(response.choices[0].message.content)
```

#### Anthropic SDK (Python)

```python
import anthropic

client = anthropic.Anthropic(
    api_key="YOUR_API_KEY",
    base_url="https://api.apertis.ai"
)

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
            "model": "gpt-4o-mini"
        }
    }
)

print(message.content[0].text)
```

#### cURL

```bash
curl https://api.apertis.ai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4.1-mini",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "compression": {
      "enabled": true,
      "strategy": "on",
      "model": "gpt-4o-mini"
    }
  }'
```

### Method 2: Request Headers

Add compression headers to individual requests. Useful for cURL or custom HTTP clients.

```bash
curl https://api.apertis.ai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Context-Compression: on" \
  -H "X-Compression-Threshold: 8000" \
  -H "X-Compression-Keep-Turns: 6" \
  -H "X-Compression-Model: auto" \
  -d '{
    "model": "gpt-4.1-mini",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

| Header | Values | Description |
|--------|--------|-------------|
| `X-Context-Compression` | `on`, `conservative`, `aggressive`, `off` | Compression strategy |
| `X-Compression-Threshold` | integer (e.g., `8000`) | Token count threshold to trigger compression |
| `X-Compression-Keep-Turns` | integer (e.g., `6`) | Number of recent turns to always preserve |
| `X-Compression-Model` | model ID or `auto` | Model used for summarization |

### Method 3: Token-Level Defaults

Configure compression defaults on your API key via the Apertis dashboard. Go to **API Keys** → **Edit** → **Compression** tab.

This sets default compression behavior for all requests made with that key, without any code changes. Per-request settings (body or headers) override token-level defaults.

## Configuration Parameters

### `compression` Object

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable or disable compression |
| `strategy` | string | `"on"` | Compression strategy (see below) |
| `threshold` | integer | `8000` | Minimum token count to trigger compression |
| `keep_turns` | integer | Per strategy | Number of recent conversation turns to preserve |
| `model` | string | `"auto"` | Model to use for summarization |

### Strategies

| Strategy | Keep Turns | Description |
|----------|-----------|-------------|
| `on` | 6 | Balanced — good default for most use cases |
| `conservative` | 8 | Preserves more recent context, compresses less aggressively |
| `aggressive` | 3 | Maximum compression, keeps fewer recent turns |

### Auto Model Selection

When `model` is set to `"auto"` (default), Apertis selects the compression model based on the target model:

- **Claude models** → `claude-3-5-haiku-latest`
- **All other models** → `gpt-4o-mini`

You can also specify a specific model (e.g., `"gpt-4o-mini"`, `"claude-3-5-haiku-latest"`).

## Response Headers

When compression is enabled, Apertis adds response headers to indicate compression status:

### When Compression is Applied

| Header | Example | Description |
|--------|---------|-------------|
| `X-Compression-Applied` | `true` | Compression was applied |
| `X-Compression-Original-Tokens` | `50000` | Original token count before compression |
| `X-Compression-Final-Tokens` | `8000` | Token count after compression |
| `X-Compression-Savings` | `84%` | Percentage of tokens saved |

### When Compression is Skipped

| Header | Example | Description |
|--------|---------|-------------|
| `X-Compression-Applied` | `false` | Compression was not applied |
| `X-Compression-Error` | `compression-not-cost-effective` | Machine-readable reason |
| `X-Compression-Message` | *(human-readable explanation)* | Detailed explanation |

#### Error Codes

| Error Code | Meaning |
|------------|---------|
| `compression-not-cost-effective` | The cost of running the compression model exceeds the estimated token savings. Common with short conversations. |
| `compression-model-unavailable:<model>` | The specified compression model is not available. Use `"auto"` or check the model name. |
| `compression-call-failed` | The compression model call failed. The original request proceeds without compression. |

## Multimodal Safety

Compression automatically protects multimodal content:

- Messages containing **images**, **audio**, or **documents** are moved to the "recent" segment and are never compressed
- Only text-based messages in the compressible history are summarized

## Cost Considerations

Compression has its own cost (the summarization call), so Apertis performs an automatic **cost-effectiveness check** before compressing:

- If the estimated savings from compression outweigh the cost of the summarization call, compression proceeds
- If compression would cost more than it saves (common with short conversations), it is skipped automatically
- The `X-Compression-Error: compression-not-cost-effective` header indicates when this happens

:::tip When to Enable Compression
Context compression is most effective for:
- **Long-running conversations** (20+ turns)
- **Expensive target models** (e.g., GPT-4, Claude Opus) where token savings are significant
- **Chatbot applications** where conversations accumulate over time

It is less effective for:
- Short conversations (< 10 turns)
- Cheap models where the compression cost may exceed savings
- Single-turn requests
:::

## Supported Endpoints

| Endpoint | Supported |
|----------|-----------|
| `/v1/chat/completions` | Yes |
| `/v1/messages` | Yes |
| `/v1/responses` | No |
| `/v1/images/generations` | No |
| `/v1/audio/*` | No |
| `/v1/embeddings` | No |

## Graceful Degradation

Compression never blocks your main request. If compression fails for any reason:

- The original uncompressed conversation is forwarded to the target model
- The response is returned normally (HTTP 200)
- Compression status is communicated via response headers only

Your application does not need special error handling for compression failures.
