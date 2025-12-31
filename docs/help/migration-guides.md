# Migration Guides

This guide helps you migrate to Apertis from other API providers or update between API versions.

## Migrating from OpenAI

Apertis is fully compatible with the OpenAI API format, making migration straightforward.

### Step 1: Update Base URL

The only required change is updating the base URL:

**Python:**
```python
from openai import OpenAI

# Before (OpenAI)
client = OpenAI(
    api_key="sk-openai-key"
)

# After (Apertis)
client = OpenAI(
    api_key="sk-apertis-key",
    base_url="https://api.apertis.ai/v1"
)
```

**Node.js:**
```javascript
import OpenAI from 'openai';

// Before (OpenAI)
const client = new OpenAI({
  apiKey: 'sk-openai-key'
});

// After (Apertis)
const client = new OpenAI({
  apiKey: 'sk-apertis-key',
  baseURL: 'https://api.apertis.ai/v1'
});
```

**cURL:**
```bash
# Before (OpenAI)
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer sk-openai-key" \
  ...

# After (Apertis)
curl https://api.apertis.ai/v1/chat/completions \
  -H "Authorization: Bearer sk-apertis-key" \
  ...
```

### Step 2: Get Your Apertis API Key

1. Sign up at [api.apertis.ai](https://api.apertis.ai)
2. Navigate to **API Keys**
3. Create a new API key
4. Store it securely

### Step 3: Update Environment Variables

```bash
# Before
export OPENAI_API_KEY="sk-openai-key"

# After
export APERTIS_API_KEY="sk-apertis-key"
export APERTIS_BASE_URL="https://api.apertis.ai/v1"
```

### Step 4: Test Your Integration

```python
from openai import OpenAI
import os

client = OpenAI(
    api_key=os.environ.get("APERTIS_API_KEY"),
    base_url=os.environ.get("APERTIS_BASE_URL")
)

# Test with a simple request
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)
```

### Model Name Mapping

Most OpenAI models are available with the same names:

| OpenAI Model | Apertis Model | Notes |
|--------------|---------------|-------|
| gpt-4o | gpt-4o | ✓ Same |
| gpt-4o-mini | gpt-4o-mini | ✓ Same |
| gpt-4-turbo | gpt-4-turbo | ✓ Same |
| gpt-3.5-turbo | gpt-3.5-turbo | ✓ Same |
| text-embedding-3-small | text-embedding-3-small | ✓ Same |
| whisper-1 | whisper-1 | ✓ Same |
| tts-1 | tts-1 | ✓ Same |
| dall-e-3 | dall-e-3 | ✓ Same |

### Additional Models

Apertis provides access to models not available directly from OpenAI:

```python
# Use Claude models
response = client.chat.completions.create(
    model="claude-3-5-sonnet-20241022",
    messages=[{"role": "user", "content": "Hello!"}]
)

# Use Gemini models
response = client.chat.completions.create(
    model="gemini-1.5-pro",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

## Migrating from Anthropic (Claude Direct)

### API Format Differences

Anthropic uses a different API format. Here's how to migrate:

**Before (Anthropic SDK):**
```python
import anthropic

client = anthropic.Anthropic(api_key="sk-ant-xxx")

message = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)
```

**After (Apertis with OpenAI format):**
```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-apertis-key",
    base_url="https://api.apertis.ai/v1"
)

response = client.chat.completions.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)
```

### Key Differences

| Feature | Anthropic API | Apertis API |
|---------|--------------|-------------|
| SDK | anthropic | openai |
| Response format | `message.content[0].text` | `choices[0].message.content` |
| System prompt | `system` parameter | System message in `messages` |
| Streaming | Different format | OpenAI SSE format |

### System Prompts

**Anthropic format:**
```python
message = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    system="You are a helpful assistant.",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

**Apertis format:**
```python
response = client.chat.completions.create(
    model="claude-3-5-sonnet-20241022",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"}
    ]
)
```

### Response Parsing

**Anthropic:**
```python
text = message.content[0].text
```

**Apertis:**
```python
text = response.choices[0].message.content
```

## Migrating from Azure OpenAI

### Configuration Changes

**Before (Azure OpenAI):**
```python
from openai import AzureOpenAI

client = AzureOpenAI(
    api_key="azure-api-key",
    api_version="2024-02-15-preview",
    azure_endpoint="https://your-resource.openai.azure.com"
)

response = client.chat.completions.create(
    model="your-deployment-name",  # Deployment name, not model
    messages=[{"role": "user", "content": "Hello!"}]
)
```

**After (Apertis):**
```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-apertis-key",
    base_url="https://api.apertis.ai/v1"
)

response = client.chat.completions.create(
    model="gpt-4o",  # Actual model name
    messages=[{"role": "user", "content": "Hello!"}]
)
```

### Key Differences

| Feature | Azure OpenAI | Apertis |
|---------|--------------|---------|
| Client | AzureOpenAI | OpenAI |
| Model param | Deployment name | Model name |
| API versioning | Required | Not needed |
| Endpoint | Custom per resource | Fixed |

## Migrating from Google (Vertex AI / Gemini)

### From Vertex AI SDK

**Before (Vertex AI):**
```python
import vertexai
from vertexai.generative_models import GenerativeModel

vertexai.init(project="your-project", location="us-central1")
model = GenerativeModel("gemini-1.5-pro")

response = model.generate_content("Hello!")
```

**After (Apertis):**
```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-apertis-key",
    base_url="https://api.apertis.ai/v1"
)

response = client.chat.completions.create(
    model="gemini-1.5-pro",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

### From Google AI Studio

**Before (Google AI SDK):**
```python
import google.generativeai as genai

genai.configure(api_key="google-api-key")
model = genai.GenerativeModel("gemini-1.5-pro")

response = model.generate_content("Hello!")
text = response.text
```

**After (Apertis):**
```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-apertis-key",
    base_url="https://api.apertis.ai/v1"
)

response = client.chat.completions.create(
    model="gemini-1.5-pro",
    messages=[{"role": "user", "content": "Hello!"}]
)
text = response.choices[0].message.content
```

## Migrating from Other Providers

### LiteLLM

If you're using LiteLLM, you can switch to Apertis:

**Before (LiteLLM):**
```python
from litellm import completion

response = completion(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

**After (Apertis):**
```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-apertis-key",
    base_url="https://api.apertis.ai/v1"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

### OpenRouter

**Before (OpenRouter):**
```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-or-xxx",
    base_url="https://openrouter.ai/api/v1"
)
```

**After (Apertis):**
```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-apertis-key",
    base_url="https://api.apertis.ai/v1"
)
```

## Framework Migrations

### LangChain

```python
from langchain_openai import ChatOpenAI

# Before
llm = ChatOpenAI(model="gpt-4")

# After
llm = ChatOpenAI(
    model="gpt-4o",
    openai_api_key="sk-apertis-key",
    openai_api_base="https://api.apertis.ai/v1"
)
```

### LlamaIndex

```python
from llama_index.llms.openai import OpenAI

# Before
llm = OpenAI(model="gpt-4")

# After
llm = OpenAI(
    model="gpt-4o",
    api_key="sk-apertis-key",
    api_base="https://api.apertis.ai/v1"
)
```

## Migration Checklist

### Pre-Migration

- [ ] Sign up for Apertis account
- [ ] Create API key
- [ ] Review current API usage patterns
- [ ] Identify all integration points
- [ ] Plan testing strategy

### During Migration

- [ ] Update base URL/endpoint
- [ ] Update API key
- [ ] Update environment variables
- [ ] Update model names if needed
- [ ] Test each integration point

### Post-Migration

- [ ] Verify all features work correctly
- [ ] Monitor error rates
- [ ] Check response quality
- [ ] Review billing/usage
- [ ] Update documentation

## Troubleshooting Migration Issues

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Wrong API key | Use Apertis key, not old provider key |
| Model not found | Different model name | Check [available models](../installation/models) |
| Different response format | SDK mismatch | Use OpenAI SDK format |
| Missing features | Not all features supported | Check documentation for alternatives |

### Getting Help

If you encounter issues during migration:

1. Check the [Troubleshooting Guide](./troubleshooting)
2. Review [Error Codes](./error-codes)
3. Contact support at hi@apertis.ai

## Related Topics

- [Quick Start](../getting-started/quick-start) - Get started with Apertis
- [API Keys](../authentication/api-keys) - Key management
- [Models](../installation/models) - Available models
- [FAQ](./faq) - Common questions
