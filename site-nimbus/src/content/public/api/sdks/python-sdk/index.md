# Apertis Python SDK

Official Python SDK for the Apertis AI API, providing a comprehensive interface to the models available to your Apertis API key through a unified, type-safe library.

## Features

- **Sync and Async Support** - Both synchronous and asynchronous clients for flexible integration
- **Streaming** - Real-time response streaming for chat completions
- **Tool Calling** - Function/tool calling support for building AI agents
- **Embeddings** - Text embedding generation with batch processing
- **Vision** - Image analysis with multimodal models
- **Audio** - Audio input and output support for voice applications
- **Video** - Video content analysis capabilities
- **Web Search** - Real-time web search with citation support
- **Reasoning** - Chain-of-thought reasoning and extended thinking
- **Messages API** - Anthropic-native message format compatibility
- **Responses API** - OpenAI Responses API format support
- **Rerank** - `client.rerank.create()` exists, but the endpoint is not currently available
- **Full Type Hints** - Complete type annotations for IDE support
- **Automatic Retries** - Built-in retry logic for transient errors

## Installation

```bash
pip install apertis
```

## Setup

Get your API Key from [**Apertis**](https://apertis.ai/setting?tab=keys)

### Environment Variable (Recommended)

```bash
export APERTIS_API_KEY=sk-your-api-key
```

### Code Configuration

```python
from apertis import Apertis

# Uses APERTIS_API_KEY environment variable automatically
client = Apertis()

# Or provide API key directly
client = Apertis(api_key="sk-your-api-key")
```

## Quick Start

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.chat.completions.create(
        model="gpt-5.4-mini",
        messages=[
            {"role": "user", "content": "Hello! What can you help me with?"}
        ]
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Supported Models

Access models from multiple providers through a single API:

| Provider | Example Models |
|----------|----------------|
| OpenAI | `gpt-5.5`, `gpt-5.4-mini`, `o4-mini-high`, `o3-mini-high` |
| Anthropic | `claude-sonnet-4-6`, `claude-opus-4-5-20251101`, `claude-haiku-4.5` |
| Google | `gemini-3-pro-preview`, `gemini-2.5-flash`, `gemini-2.0-flash` |
| DeepSeek | `deepseek-chat`, `deepseek-reasoner` |
| xAI | `grok-4.3`, `grok-4-fast` |
| Current catalog | [View models available to your key](/api/utilities/models) |

## Feature Documentation

- [Chat Completions](/api/sdks/python-sdk/chat-completions) - Basic chat and text generation
- [Streaming](/api/sdks/python-sdk/streaming) - Real-time response streaming
- [Tool Calling](/api/sdks/python-sdk/tool-calling) - Function calling for AI agents
- [Embeddings](/api/sdks/python-sdk/embeddings) - Text embeddings and batch processing
- [Vision](/api/sdks/python-sdk/vision) - Image analysis with multimodal models
- [Audio](/api/sdks/python-sdk/audio) - Audio input and output
- [Video](/api/sdks/python-sdk/video) - Video content analysis
- [Web Search](/api/sdks/python-sdk/web-search) - Real-time search with citations
- [Reasoning](/api/sdks/python-sdk/reasoning) - Chain-of-thought and extended thinking
- [Messages API](/api/sdks/python-sdk/messages-api) - Anthropic-native format
- [Responses API](/api/sdks/python-sdk/responses-api) - OpenAI Responses format
- [Rerank](/api/sdks/python-sdk/rerank) - Not currently available
- [Async Patterns](/api/sdks/python-sdk/async) - Asynchronous client usage

## Resources

- [GitHub Repository](https://github.com/apertis-ai/python-sdk)
- [PyPI Package](https://pypi.org/project/apertis)
