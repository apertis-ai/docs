# Quick Start

Get up and running with the Apertis API in under 5 minutes. This guide walks you through making your first API call.

## Prerequisites

- An Apertis account ([Create one](https://apertis.ai/register); no card is required to register)
- Model access through a [Coding Plan](https://apertis.ai/subscribe) or [PAYG balance](https://apertis.ai/setting?tab=credits)
- An API key from [Settings → API Keys](https://apertis.ai/setting?tab=keys)
- Basic knowledge of HTTP requests or a programming language

## Step 1: Create Your Account and Choose Access

1. [Create an Apertis account](https://apertis.ai/register) or [log in](https://apertis.ai/login).
2. Choose a [Coding Plan](https://apertis.ai/subscribe) or add [PAYG balance](https://apertis.ai/setting?tab=credits) before your first API request.
3. Use the [Models page](https://apertis.ai/models) to confirm which model IDs are available for your key type.

Creating an account does not require a card. A plan or PAYG balance is still required before a paid model request can succeed.

## Step 2: Create Your API Key

1. Open [**Settings → API Keys**](https://apertis.ai/setting?tab=keys).
2. Click **Create New Key**.
3. Copy your key (format: `sk-xxxxxxxx`).

:::tip Subscription users
If you have an active subscription, a dedicated key (`sk-sub-...`) is already created for you. Find it in **Settings** → **API Keys** tab (click **My Plan** in the navbar).
:::

:::warning
Save your API key securely. It's only shown once!
:::

## Step 3: Make Your First Request

Choose your preferred method:

### Using cURL

```bash
curl https://api.apertis.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{
    "model": "gpt-5.5",
    "messages": [
      {"role": "user", "content": "Hello! What can you do?"}
    ]
  }'
```

### Using Python

First, install the OpenAI SDK:

```bash
pip install openai
```

Then make a request:

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-api-key",
    base_url="https://api.apertis.ai/v1"
)

response = client.chat.completions.create(
    model="gpt-5.5",
    messages=[
        {"role": "user", "content": "Hello! What can you do?"}
    ]
)

print(response.choices[0].message.content)
```

### Using Node.js

First, install the OpenAI SDK:

```bash
npm install openai
```

Then make a request:

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-api-key',
  baseURL: 'https://api.apertis.ai/v1'
});

async function main() {
  const response = await client.chat.completions.create({
    model: 'gpt-5.5',
    messages: [
      { role: 'user', content: 'Hello! What can you do?' }
    ]
  });

  console.log(response.choices[0].message.content);
}

main();
```

## Step 4: Verify the Response and Activity Record

A successful response looks like this:

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1703894400,
  "model": "gpt-5.5",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm an AI assistant. I can help you with..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 45,
    "total_tokens": 57
  }
}
```

### Key Fields

| Field | Description |
|-------|-------------|
| `id` | Unique identifier for this completion |
| `model` | The model used for generation |
| `choices[0].message.content` | The AI's response |
| `usage` | Token usage for billing |

After the request succeeds, open [**Settings → Activity**](https://apertis.ai/setting?tab=activity) and confirm the matching Activity record. The integration is complete only when you have both a successful response and the matching Activity record; account creation by itself is not activation.

## Step 5: Try Different Models

Apertis provides a live model catalog across multiple providers. Availability changes over time and can vary by key type, so check the [Models page](https://apertis.ai/models) or query `GET /v1/models` before pinning an ID in production.

```python
# OpenAI GPT-5.5
response = client.chat.completions.create(
    model="gpt-5.5",
    messages=[{"role": "user", "content": "Explain quantum computing"}]
)

# Anthropic Claude Sonnet 4.6
response = client.chat.completions.create(
    model="claude-sonnet-4-6",
    messages=[{"role": "user", "content": "Explain quantum computing"}]
)

# Google Gemini Pro
response = client.chat.completions.create(
    model="gemini-3.1-pro-preview",
    messages=[{"role": "user", "content": "Explain quantum computing"}]
)
```

### Popular Models

| Model | Best For |
|-------|----------|
| `gpt-5.5` | General purpose, balanced |
| `gpt-5.4-mini` | Fast, cost-effective |
| `claude-sonnet-4-6` | Long context, analysis |
| `claude-opus-4-8` | Complex reasoning |
| `gemini-3.1-pro-preview` | Multimodal, long context |

[View all models →](../installation/models)

## Step 6: Enable Streaming

For real-time responses, enable streaming:

```python
response = client.chat.completions.create(
    model="gpt-5.5",
    messages=[{"role": "user", "content": "Write a short poem"}],
    stream=True  # Enable streaming
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

## Common Use Cases

### Multi-turn Conversations

```python
messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What's the capital of France?"},
    {"role": "assistant", "content": "The capital of France is Paris."},
    {"role": "user", "content": "What's the population?"}
]

response = client.chat.completions.create(
    model="gpt-5.5",
    messages=messages
)
```

### Code Generation

```python
response = client.chat.completions.create(
    model="gpt-5.5",
    messages=[{
        "role": "user",
        "content": "Write a Python function to calculate fibonacci numbers"
    }]
)
```

### Image Analysis

```python
response = client.chat.completions.create(
    model="gpt-5.5",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "What's in this image?"},
            {"type": "image_url", "image_url": {"url": "https://example.com/image.jpg"}}
        ]
    }]
)
```

### Text Embeddings

```python
response = client.embeddings.create(
    model="text-embedding-3-small",
    input="Hello, world!"
)

embedding = response.data[0].embedding
print(f"Embedding dimension: {len(embedding)}")
```

## Environment Variables

For production, use environment variables instead of hardcoding:

```bash
# Set environment variable
export APERTIS_API_KEY="sk-your-api-key"
```

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("APERTIS_API_KEY"),
    base_url="https://api.apertis.ai/v1"
)
```

## Error Handling

Always handle potential errors:

```python
from openai import OpenAI, APIError, RateLimitError

client = OpenAI(
    api_key="sk-your-api-key",
    base_url="https://api.apertis.ai/v1"
)

try:
    response = client.chat.completions.create(
        model="gpt-5.5",
        messages=[{"role": "user", "content": "Hello!"}]
    )
    print(response.choices[0].message.content)

except RateLimitError:
    print("Rate limited! Please wait and retry.")

except APIError as e:
    print(f"API error: {e}")
```

## Next Steps

Now that you've made your first API call, explore more:

- [API Keys](../authentication/api-keys) - Manage and secure your keys
- [Models](../installation/models) - Browse all available models
- [Subscription Plans](../billing/subscription-plans) - Choose the right plan
- [Streaming](/api/text-generation/streaming) - Real-time response streaming
- [Integrations](../installation/cline) - Use with Cursor, Cline, and more

## Quick Reference

### Base URL
```
https://api.apertis.ai/v1
```

### Authentication
```
Authorization: Bearer sk-your-api-key
```

### Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `/v1/chat/completions` | Chat completions |
| `/v1/embeddings` | Text embeddings |
| `/v1/images/generations` | Image generation |
| `/v1/audio/speech` | Text to speech |
| `/v1/audio/transcriptions` | Speech to text |
| `/v1/models` | List available models |

## Getting Help

- [Troubleshooting Guide](../help/troubleshooting)
- [Error Codes Reference](../help/error-codes)
- [Contact Support](mailto:hi@apertis.ai)
