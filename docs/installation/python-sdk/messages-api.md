# Messages API

Use Anthropic's native message format for interacting with Claude models, providing access to Claude-specific features and optimal performance.

## Prerequisites

```bash
pip install apertis
```

Get your API Key from [**Apertis**](https://apertis.ai/token)

## Basic Usage

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.messages.create(
        model="claude-sonnet-4.5",
        max_tokens=1024,
        messages=[
            {"role": "user", "content": "Hello, Claude!"}
        ]
    )

    print(response.content[0].text)

if __name__ == "__main__":
    main()
```

## System Prompts

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.messages.create(
        model="claude-sonnet-4.5",
        max_tokens=1024,
        system="You are a helpful coding assistant specializing in Python.",
        messages=[
            {"role": "user", "content": "How do I read a JSON file?"}
        ]
    )

    print(response.content[0].text)

if __name__ == "__main__":
    main()
```

## Multi-Turn Conversations

```python
from apertis import Apertis

def main():
    client = Apertis()

    messages = [
        {"role": "user", "content": "What is recursion?"},
    ]

    response = client.messages.create(
        model="claude-sonnet-4.5",
        max_tokens=1024,
        messages=messages
    )

    print("Claude:", response.content[0].text)

    # Continue conversation
    messages.append({"role": "assistant", "content": response.content[0].text})
    messages.append({"role": "user", "content": "Can you show me an example in Python?"})

    response = client.messages.create(
        model="claude-sonnet-4.5",
        max_tokens=1024,
        messages=messages
    )

    print("\nClaude:", response.content[0].text)

if __name__ == "__main__":
    main()
```

## Streaming

```python
from apertis import Apertis

def main():
    client = Apertis()

    with client.messages.stream(
        model="claude-sonnet-4.5",
        max_tokens=1024,
        messages=[
            {"role": "user", "content": "Write a short poem about coding."}
        ]
    ) as stream:
        for text in stream.text_stream:
            print(text, end="", flush=True)

    print()

if __name__ == "__main__":
    main()
```

## Vision with Messages API

```python
import base64
from apertis import Apertis

def main():
    client = Apertis()

    # From URL
    response = client.messages.create(
        model="claude-sonnet-4.5",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "url",
                            "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg"
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

    print(response.content[0].text)

if __name__ == "__main__":
    main()
```

## Tool Use (Function Calling)

```python
import json
from apertis import Apertis

def main():
    client = Apertis()

    tools = [
        {
            "name": "get_weather",
            "description": "Get the current weather in a given location",
            "input_schema": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA"
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "The unit of temperature"
                    }
                },
                "required": ["location"]
            }
        }
    ]

    response = client.messages.create(
        model="claude-sonnet-4.5",
        max_tokens=1024,
        tools=tools,
        messages=[
            {"role": "user", "content": "What's the weather like in Tokyo?"}
        ]
    )

    for content in response.content:
        if content.type == "tool_use":
            print(f"Tool: {content.name}")
            print(f"Input: {json.dumps(content.input, indent=2)}")
        elif content.type == "text":
            print(f"Text: {content.text}")

if __name__ == "__main__":
    main()
```

## Extended Thinking

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.messages.create(
        model="claude-sonnet-4.5",
        max_tokens=16000,
        thinking={
            "type": "enabled",
            "budget_tokens": 10000
        },
        messages=[
            {"role": "user", "content": "Analyze the trade-offs between SQL and NoSQL databases for a social media application."}
        ]
    )

    for content in response.content:
        if content.type == "thinking":
            print("=== Thinking ===")
            print(content.thinking)
            print()
        elif content.type == "text":
            print("=== Response ===")
            print(content.text)

if __name__ == "__main__":
    main()
```

## Response Metadata

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.messages.create(
        model="claude-sonnet-4.5",
        max_tokens=1024,
        messages=[
            {"role": "user", "content": "Hello!"}
        ]
    )

    print(f"Model: {response.model}")
    print(f"Stop Reason: {response.stop_reason}")
    print(f"Input Tokens: {response.usage.input_tokens}")
    print(f"Output Tokens: {response.usage.output_tokens}")
    print(f"\nContent: {response.content[0].text}")

if __name__ == "__main__":
    main()
```

## Async Messages API

```python
import asyncio
from apertis import AsyncApertis

async def main():
    client = AsyncApertis()

    response = await client.messages.create(
        model="claude-sonnet-4.5",
        max_tokens=1024,
        messages=[
            {"role": "user", "content": "What is the capital of France?"}
        ]
    )

    print(response.content[0].text)

if __name__ == "__main__":
    asyncio.run(main())
```

## Supported Models

The Messages API supports all Claude models:

| Model | Description |
|-------|-------------|
| `claude-opus-4-5-20251101` | Most capable, best for complex tasks |
| `claude-sonnet-4.5` | Balanced performance and cost |
| `claude-haiku-4-5-20250501` | Fastest, most cost-effective |

[View all models →](/references/models)

## API Reference

### Request Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | `str` | Model identifier (required) |
| `messages` | `list` | Conversation messages (required) |
| `max_tokens` | `int` | Maximum tokens to generate (required) |
| `system` | `str` | System prompt |
| `temperature` | `float` | Sampling temperature (0.0 - 1.0) |
| `top_p` | `float` | Nucleus sampling parameter |
| `top_k` | `int` | Top-k sampling parameter |
| `tools` | `list` | Tool definitions for function calling |
| `thinking` | `dict` | Extended thinking configuration |

### Response Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | `str` | Unique message ID |
| `type` | `str` | Always `"message"` |
| `role` | `str` | Always `"assistant"` |
| `content` | `list` | Content blocks (text, tool_use, thinking) |
| `model` | `str` | Model used |
| `stop_reason` | `str` | Why generation stopped |
| `usage` | `object` | Token usage information |
