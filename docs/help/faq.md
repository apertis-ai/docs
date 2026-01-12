# Frequently Asked Questions

Quick answers to common questions about the Apertis API.

## General Questions

### What is Apertis?

Apertis is a unified API platform that provides access to 60+ AI models through a single, OpenAI-compatible interface. Instead of managing multiple API keys and different SDKs, you can use one API to access models from OpenAI, Anthropic, Google, and more.

### How is Apertis different from using providers directly?

| Feature | Direct Provider | Apertis |
|---------|----------------|---------|
| API Keys | One per provider | Single unified key |
| SDK | Different per provider | Standard OpenAI SDK |
| Billing | Separate per provider | Unified billing |
| Models | Provider's models only | 60+ models |
| Fallback | Manual implementation | Built-in |

### Is Apertis compatible with OpenAI SDK?

Yes! Apertis is fully compatible with the OpenAI SDK. You only need to change the base URL:

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-apertis-key",
    base_url="https://api.apertis.ai/v1"  # Only change needed
)
```

### What models are available?

Apertis provides access to 60+ models including:

- **OpenAI**: GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus
- **Google**: Gemini 1.5 Pro, Gemini 1.5 Flash
- **Open Source**: Llama, Mistral, and more

[View full model list →](../installation/models)

---

## Account & Authentication

### How do I get an API key?

1. Sign up at [api.apertis.ai](https://api.apertis.ai)
2. Go to **API Keys** section
3. Click **Create New Key**
4. Copy and securely store your key

### I lost my API key. Can I recover it?

No, API keys are only displayed once when created. If you lose your key:

1. Create a new API key
2. Update your applications
3. Delete the old key for security

### How many API keys can I create?

There's no strict limit. You can create multiple keys for different:
- Environments (dev, staging, production)
- Applications
- Team members

### Can I share my API key?

We recommend creating separate keys for each user or application. This allows:
- Individual quota tracking
- Easy revocation if compromised
- Better security audit trails

---

## Billing & Pricing

### How does billing work?

Apertis offers two billing models:

1. **Subscription Plans**: Monthly quota with fixed pricing
2. **Pay-As-You-Go (PAYG)**: Pay per token used

[Learn more about billing →](../billing/subscription-plans)

### What's the difference between subscription and PAYG?

| Aspect | Subscription | PAYG |
|--------|-------------|------|
| Commitment | Monthly/Yearly | None |
| Pricing | Discounted | Standard |
| Best for | Predictable usage | Variable usage |

### How is usage calculated?

Usage is calculated per token:

```
Cost = (Input Tokens × Input Rate) + (Output Tokens × Output Rate)
```

Different models have different rates. [View current pricing →](https://apertis.ai/models)

### What happens when I run out of quota?

- **Subscription**: Enable PAYG fallback to continue, or wait for cycle reset
- **PAYG**: Add funds to continue

### Do unused quotas roll over?

No, subscription quotas reset at each billing cycle and don't roll over.

### Can I get a refund?

Contact support at hi@apertis.ai for refund requests. Refunds are handled case-by-case.

---

## Technical Questions

### What's the API base URL?

```
https://api.apertis.ai/v1
```

### What's the rate limit?

| Limit Type | Value |
|------------|-------|
| API requests | 1,500 per 3 minutes per IP |
| Per API key | 3,000 per minute |

[Learn more about rate limits →](../billing/rate-limits)

### Do you support streaming?

Yes! Enable streaming with `stream=True`:

```python
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
    stream=True
)

for chunk in response:
    print(chunk.choices[0].delta.content, end="")
```

### What's the maximum context length?

It depends on the model:

| Model | Context Length |
|-------|----------------|
| GPT-4o | 128K tokens |
| Claude 3.5 Sonnet | 200K tokens |
| Gemini 1.5 Pro | 1M tokens |

### Do you support function calling?

Yes, function calling is supported for compatible models:

```python
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "What's the weather?"}],
    tools=[{
        "type": "function",
        "function": {
            "name": "get_weather",
            "parameters": {...}
        }
    }]
)
```

### Do you support vision (image input)?

Yes, for models that support it:

```python
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "What's in this image?"},
            {"type": "image_url", "image_url": {"url": "https://..."}}
        ]
    }]
)
```

### What audio formats are supported?

For speech-to-text: MP3, MP4, MPEG, MPGA, M4A, WAV, WebM

For text-to-speech: MP3, Opus, AAC, FLAC, WAV, PCM

---

## Integrations

### Does Apertis work with LangChain?

Yes:

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gpt-4o",
    openai_api_key="sk-your-key",
    openai_api_base="https://api.apertis.ai/v1"
)
```

### Does Apertis work with Cursor/Cline/Continue?

Yes! Apertis works with all OpenAI-compatible tools:

- [Cursor Integration](../installation/cursor)
- [Cline Integration](../installation/cline)
- [Continue Integration](../installation/continue)

### Can I use Apertis with my existing OpenAI code?

Yes, just change the base URL and API key. No other code changes needed.

---

## Models & Features

### Which model should I use?

| Use Case | Recommended Model |
|----------|-------------------|
| General chat | GPT-4o |
| Fast & cheap | GPT-4o-mini |
| Complex reasoning | Claude 3 Opus |
| Long documents | Claude 3.5 Sonnet |
| Code generation | GPT-4o or Claude 3.5 Sonnet |

### Are model responses the same as direct providers?

Yes, Apertis routes requests to the actual providers. Responses are identical to what you'd get directly.

### What is fallback models?

Fallback automatically switches to an alternative model if your primary model fails:

```python
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[...],
    extra_body={
        "fallback_models": ["claude-3-5-sonnet-20241022", "gemini-1.5-pro"]
    }
)
```

[Learn more about fallback →](../installation/fallback_models)

### Is there a model playground?

Yes! Visit [playground.apertis.ai](https://playground.apertis.ai) to test models interactively.

---

## Security & Privacy

### Is my data secure?

Yes. We implement industry-standard security practices:
- HTTPS/TLS encryption for all connections
- API keys are encrypted at rest
- No logging of request/response content by default

### Do you store my prompts or responses?

By default, we don't store prompt or response content. Only metadata (token counts, timestamps) is logged for billing.

### Is Apertis SOC 2 compliant?

Contact support for compliance documentation and enterprise security features.

### Can I restrict API key by IP?

Yes, you can set IP whitelists for each API key in the dashboard.

---

## Troubleshooting

### I'm getting 401 Unauthorized

- Check your API key is correct
- Ensure the `Authorization: Bearer` format is used
- Verify the key hasn't been deleted or expired

### I'm getting 429 Too Many Requests

- You've hit the rate limit
- Wait and retry with exponential backoff
- Consider upgrading your plan for higher limits

### I'm getting 402 Payment Required

- Your quota is exhausted
- Add funds (PAYG) or wait for cycle reset (subscription)
- Enable PAYG fallback for subscriptions

### My requests are slow

- Use streaming for long responses
- Check your network connection
- Some models are slower than others

[Full troubleshooting guide →](./troubleshooting)

---

## Account Management

### How do I change my email?

1. Go to **Account Settings**
2. Click **Change Email**
3. Verify the new email address

### How do I delete my account?

Contact support at hi@apertis.ai to request account deletion.

### Can I have multiple accounts?

We recommend using a single account with multiple API keys instead of multiple accounts.

---

## Support

### How do I contact support?

- **Email**: hi@apertis.ai
- **Dashboard**: Submit a ticket

### What are support hours?

We aim to respond within 24 hours on business days.

### Is there a status page?

Yes: [status.stima.tech](https://status.stima.tech)

---

## Still have questions?

- Check our [Troubleshooting Guide](./troubleshooting)
- Review [Error Codes](./error-codes)
- Contact support at hi@apertis.ai
