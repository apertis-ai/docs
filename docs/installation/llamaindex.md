# LlamaIndex

LlamaIndex has native support for Apertis through the `llama-index-llms-apertis` package.

## Installation

```bash
pip install llama-index-llms-apertis llama-index
```

## Basic Setup

```python
from llama_index.llms.apertis import Apertis
from llama_index.core.llms import ChatMessage

# Configure with your API key from https://apertis.ai/token
llm = Apertis(
    api_key="sk-your-api-key",
    model="gpt-5.2",
    max_tokens=256,
    context_window=4096,
)
```

## Chat API

```python
message = ChatMessage(role="user", content="Tell me a joke")
resp = llm.chat([message])
print(resp)
```

### Streaming Chat

```python
message = ChatMessage(role="user", content="Tell me a story in 250 words")
resp = llm.stream_chat([message])
for r in resp:
    print(r.delta, end="")
```

## Completion API

```python
resp = llm.complete("Tell me a joke")
print(resp)
```

### Streaming Completion

```python
resp = llm.stream_complete("Tell me a story in 250 words")
for r in resp:
    print(r.delta, end="")
```

## Using Different Models

Access 400+ models through Apertis:

```python
# OpenAI GPT
llm = Apertis(model="gpt-5.2")

# Anthropic Claude
llm = Apertis(model="claude-sonnet-4.5")

# Google Gemini
llm = Apertis(model="gemini-3-flash-preview")
```

## Supported Models

| Provider | Model ID |
|----------|----------|
| OpenAI | `gpt-5.2`, `gpt-4.1-mini` |
| Anthropic | `claude-sonnet-4.5`, `claude-haiku-4.5` |
| Google | `gemini-3-pro-preview`, `gemini-3-flash-preview` |

For the full list of models, visit [Apertis Models](https://apertis.ai/models).
