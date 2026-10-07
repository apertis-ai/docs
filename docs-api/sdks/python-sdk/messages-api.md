# Messages API

Use Anthropic's native message format for interacting with Claude models, providing access to Claude-specific features and optimal performance.

## Prerequisites

```bash
pip install "apertis>=0.4.0"
```

Get your API Key from [**Apertis**](https://apertis.ai/setting?tab=keys)

## Basic Usage

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.messages.create(
        model="claude-sonnet-4-6",
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
        model="claude-sonnet-4-6",
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
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=messages
    )

    print("Claude:", response.content[0].text)

    # Continue conversation
    messages.append({"role": "assistant", "content": response.content[0].text})
    messages.append({"role": "user", "content": "Can you show me an example in Python?"})

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=messages
    )

    print("\nClaude:", response.content[0].text)

if __name__ == "__main__":
    main()
```

## Streaming

`stream=True` returns an iterator of Anthropic stream events (`apertis` 0.4.0 or later):

```python
from apertis import Apertis

def main():
    client = Apertis()

    stream = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[
            {"role": "user", "content": "Write a short poem about coding."}
        ],
        stream=True,
    )

    for event in stream:
        if event.type == "content_block_delta" and event.delta.type == "text_delta":
            print(event.delta.text, end="", flush=True)

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
        model="claude-sonnet-4-6",
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
        model="claude-sonnet-4-6",
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

Pass `thinking` to get the model's reasoning as `thinking` blocks before the answer (`apertis` 0.4.0 or later):

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.messages.create(
        model="claude-sonnet-4-6",
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

With `stream=True`, thinking arrives as `thinking_delta` events before the `text_delta` events.

## Response Metadata

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.messages.create(
        model="claude-sonnet-4-6",
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
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[
            {"role": "user", "content": "What is the capital of France?"}
        ]
    )

    print(response.content[0].text)

if __name__ == "__main__":
    asyncio.run(main())
```

## Context Compression

Reduce token usage for long conversations by enabling [context compression](/api/text-generation/context-compression):

```python
from apertis import Apertis

def main():
    client = Apertis()

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[
            {"role": "user", "content": "Explain distributed systems"},
            {"role": "assistant", "content": "Distributed systems are..."},
            # ... many turns of conversation history ...
            {"role": "user", "content": "Summarize the key points"}
        ],
        compression={
            "enabled": True,
            "strategy": "on",
            "model": "gpt-5.4-mini"
        }
    )

    print(message.content[0].text)

if __name__ == "__main__":
    main()
```

## Supported Models

The Messages API supports all Claude models:

| Model | Description |
|-------|-------------|
| `claude-opus-4-5-20251101` | Most capable, best for complex tasks |
| `claude-sonnet-4-6` | Balanced performance and cost |
| `claude-haiku-4.5` | Fastest, most cost-effective |

[View all models →](/api/utilities/models)

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
| `stop_sequences` | `list` | Sequences that stop generation |
| `tools` | `list` | Tool definitions for function calling |
| `tool_choice` | `dict` | Tool selection |
| `metadata` | `dict` | Request metadata |
| `compression` | `dict` | [Context compression](/api/text-generation/context-compression) settings |
| `stream` | `bool` | Return an iterator of stream events (0.4.0 or later) |
| `thinking` | `dict` | Extended thinking, for example `{"type": "enabled", "budget_tokens": 10000}` (0.4.0 or later) |
| `extra_body` | `dict` | Extra fields merged into the top level of the request (0.4.0 or later) |

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
