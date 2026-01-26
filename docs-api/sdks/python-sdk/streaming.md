# Streaming

Receive responses in real-time as they are generated, enabling responsive user interfaces and faster time-to-first-token.

## Prerequisites

```bash
pip install apertis
```

Get your API Key from [**Apertis**](https://apertis.ai/token)

## Basic Streaming

```python
from apertis import Apertis

def main():
    client = Apertis()

    stream = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "user", "content": "Write a short poem about coding."}
        ],
        stream=True
    )

    for chunk in stream:
        if chunk.choices[0].delta.content:
            print(chunk.choices[0].delta.content, end="", flush=True)

    print()  # Newline at the end

if __name__ == "__main__":
    main()
```

## Collecting Streamed Content

```python
from apertis import Apertis

def main():
    client = Apertis()

    stream = client.chat.completions.create(
        model="claude-sonnet-4.5",
        messages=[
            {"role": "user", "content": "Explain machine learning in 3 sentences."}
        ],
        stream=True
    )

    collected_content = []

    for chunk in stream:
        content = chunk.choices[0].delta.content
        if content:
            collected_content.append(content)
            print(content, end="", flush=True)

    print()

    # Full response
    full_response = "".join(collected_content)
    print(f"\n--- Collected {len(full_response)} characters ---")

if __name__ == "__main__":
    main()
```

## Streaming with Context Manager

```python
from apertis import Apertis

def main():
    client = Apertis()

    with client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "user", "content": "List 5 programming languages and their use cases."}
        ],
        stream=True
    ) as stream:
        for chunk in stream:
            if chunk.choices[0].delta.content:
                print(chunk.choices[0].delta.content, end="", flush=True)

    print()

if __name__ == "__main__":
    main()
```

## Async Streaming

```python
import asyncio
from apertis import AsyncApertis

async def main():
    client = AsyncApertis()

    stream = await client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "user", "content": "Write a haiku about Python."}
        ],
        stream=True
    )

    async for chunk in stream:
        if chunk.choices[0].delta.content:
            print(chunk.choices[0].delta.content, end="", flush=True)

    print()

if __name__ == "__main__":
    asyncio.run(main())
```

## Streaming with Error Handling

```python
from apertis import Apertis
from apertis import APIError, RateLimitError

def main():
    client = Apertis()

    try:
        stream = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "user", "content": "Tell me a joke."}
            ],
            stream=True
        )

        for chunk in stream:
            if chunk.choices[0].delta.content:
                print(chunk.choices[0].delta.content, end="", flush=True)

        print()

    except RateLimitError as e:
        print(f"\nRate limit exceeded. Please wait and retry. {e}")
    except APIError as e:
        print(f"\nAPI error occurred: {e}")

if __name__ == "__main__":
    main()
```

## Stream Options

```python
from apertis import Apertis

def main():
    client = Apertis()

    stream = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "user", "content": "Explain quantum entanglement."}
        ],
        stream=True,
        stream_options={"include_usage": True}  # Include token usage in final chunk
    )

    for chunk in stream:
        if chunk.choices[0].delta.content:
            print(chunk.choices[0].delta.content, end="", flush=True)

        # Token usage in final chunk
        if chunk.usage:
            print(f"\n\nTokens used: {chunk.usage.total_tokens}")

if __name__ == "__main__":
    main()
```

## Supported Models

All chat models support streaming:

| Provider | Models |
|----------|--------|
| OpenAI | `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1` |
| Anthropic | `claude-sonnet-4.5`, `claude-opus-4-5-20251101`, `claude-haiku-4-5-20250501` |
| Google | `gemini-3-pro-preview`, `gemini-2.5-flash` |
| DeepSeek | `deepseek-chat` |
| xAI | `grok-3`, `grok-3-fast` |

[View all models →](/api/utilities/models)

## API Reference

| Parameter | Type | Description |
|-----------|------|-------------|
| `stream` | `bool` | Enable streaming (set to `True`) |
| `stream_options` | `dict` | Streaming options (e.g., `{"include_usage": True}`) |
