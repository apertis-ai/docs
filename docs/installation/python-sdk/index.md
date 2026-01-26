# Apertis Python SDK

Official Python SDK for the Apertis AI API, providing a comprehensive interface to access 470+ AI models through a unified, type-safe library.

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
- **Rerank** - Document reranking for RAG systems
- **Full Type Hints** - Complete type annotations for IDE support
- **Automatic Retries** - Built-in retry logic for transient errors

## Installation

```bash
pip install apertis
```

## Setup

Get your API Key from [**Apertis**](https://apertis.ai/token)

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
        model="gpt-4.1-mini",
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
| OpenAI | `gpt-4.1`, `gpt-4.1-mini`, `o1`, `o3-mini` |
| Anthropic | `claude-sonnet-4.5`, `claude-opus-4-5-20251101`, `claude-haiku-4-5-20250501` |
| Google | `gemini-3-pro-preview`, `gemini-2.5-flash`, `gemini-2.0-flash` |
| DeepSeek | `deepseek-chat`, `deepseek-reasoner` |
| xAI | `grok-3`, `grok-3-fast` |
| And 470+ more... | [View all models](/references/models) |

## Feature Documentation

- [Chat Completions](./chat-completions) - Basic chat and text generation
- [Streaming](./streaming) - Real-time response streaming
- [Tool Calling](./tool-calling) - Function calling for AI agents
- [Embeddings](./embeddings) - Text embeddings and batch processing
- [Vision](./vision) - Image analysis with multimodal models
- [Audio](./audio) - Audio input and output
- [Video](./video) - Video content analysis
- [Web Search](./web-search) - Real-time search with citations
- [Reasoning](./reasoning) - Chain-of-thought and extended thinking
- [Messages API](./messages-api) - Anthropic-native format
- [Responses API](./responses-api) - OpenAI Responses format
- [Rerank](./rerank) - Document reranking for RAG
- [Async Patterns](./async) - Asynchronous client usage

## Resources

- [GitHub Repository](https://github.com/apertis-ai/python-sdk)
- [PyPI Package](https://pypi.org/project/apertis)
