# LiteLLM

[LiteLLM](https://github.com/BerriAI/litellm) provides a unified interface to call 100+ LLMs. Apertis is supported as a native provider.

## Installation

```bash
pip install litellm
```

## Environment Setup

Set your Apertis API key:

```bash
export APERTIS_API_KEY="sk-your-api-key"
```

Or in Python:

```python
import os
os.environ["APERTIS_API_KEY"] = "sk-your-api-key"
```

Get your API key from [apertis.ai/token](https://apertis.ai/token).

## Basic Usage

### Completion

```python
import os
from litellm import completion

os.environ["APERTIS_API_KEY"] = "sk-your-api-key"

messages = [{"role": "user", "content": "What is the capital of France?"}]

response = completion(
    model="apertis/gpt-5.2",
    messages=messages
)
print(response.choices[0].message.content)
```

### Streaming

```python
from litellm import completion

messages = [{"role": "user", "content": "Write a short poem about AI"}]

response = completion(
    model="apertis/gpt-5.2",
    messages=messages,
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

## Using Different Models

Access 400+ models through the `apertis/` prefix:

```python
# OpenAI GPT
response = completion(model="apertis/gpt-5.2", messages=messages)

# Anthropic Claude
response = completion(model="apertis/claude-sonnet-4.5", messages=messages)

# Google Gemini
response = completion(model="apertis/gemini-3-flash-preview", messages=messages)
```

## LiteLLM Proxy Configuration

### 1. Export API Key

```bash
export APERTIS_API_KEY="sk-your-api-key"
```

### 2. Configure config.yaml

```yaml
model_list:
  - model_name: gpt-5.2
    litellm_params:
      model: apertis/gpt-5.2
      api_key: os.environ/APERTIS_API_KEY

  - model_name: claude-sonnet
    litellm_params:
      model: apertis/claude-sonnet-4.5
      api_key: os.environ/APERTIS_API_KEY

  - model_name: gemini-flash
    litellm_params:
      model: apertis/gemini-3-flash-preview
      api_key: os.environ/APERTIS_API_KEY
```

### 3. Start Proxy

```bash
litellm --config config.yaml
```

## Supported Parameters

All standard OpenAI-compatible parameters are supported:

| Parameter | Description |
|-----------|-------------|
| `messages` | Chat messages array |
| `model` | Model ID with `apertis/` prefix |
| `stream` | Enable streaming responses |
| `temperature` | Sampling temperature (0-2) |
| `top_p` | Nucleus sampling |
| `max_tokens` | Maximum response tokens |
| `frequency_penalty` | Frequency penalty (-2 to 2) |
| `presence_penalty` | Presence penalty (-2 to 2) |
| `stop` | Stop sequences |
| `tools` | Function/tool definitions |
| `tool_choice` | Tool selection mode |

## Popular Models

| Provider | Model ID |
|----------|----------|
| OpenAI | `apertis/gpt-5.2`, `apertis/gpt-4.1-mini` |
| Anthropic | `apertis/claude-sonnet-4.5`, `apertis/claude-haiku-4.5` |
| Google | `apertis/gemini-3-pro-preview`, `apertis/gemini-3-flash-preview` |

For the full list of models, visit [Apertis Models](https://apertis.ai/models).
