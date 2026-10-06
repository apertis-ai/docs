---
title: "Responses API"
---

# Responses API

Use OpenAI's Responses API format for enhanced capabilities including built-in tools, web search, and file handling.

## Prerequisites

```bash
pip install openai
```

<aside class="admonition admonition-note">
<p class="admonition-title">Note</p>

`apertis` 0.3.0 cannot parse Responses API output: its `Response` type expects content blocks of type `text`, while the API returns `output_text`. Until that is fixed, use the OpenAI Python SDK pointed at Apertis, as the examples on this page do.

</aside>

Get your API Key from [**Apertis**](https://apertis.ai/setting?tab=keys)

## Basic Usage

```python
import os
from openai import OpenAI

def main():
    client = OpenAI(api_key=os.environ["APERTIS_API_KEY"], base_url="https://api.apertis.ai/v1")

    response = client.responses.create(
        model="gpt-5.5",
        input="Explain the concept of machine learning."
    )

    print(response.output_text)

if __name__ == "__main__":
    main()
```

## Multi-Turn with Input Items

```python
import os
from openai import OpenAI

def main():
    client = OpenAI(api_key=os.environ["APERTIS_API_KEY"], base_url="https://api.apertis.ai/v1")

    response = client.responses.create(
        model="gpt-5.5",
        input=[
            {"type": "message", "role": "user", "content": "What is Python?"},
            {"type": "message", "role": "assistant", "content": "Python is a high-level programming language known for its simplicity and readability."},
            {"type": "message", "role": "user", "content": "What are its main uses?"}
        ]
    )

    print(response.output_text)

if __name__ == "__main__":
    main()
```

## System Instructions

```python
import os
from openai import OpenAI

def main():
    client = OpenAI(api_key=os.environ["APERTIS_API_KEY"], base_url="https://api.apertis.ai/v1")

    response = client.responses.create(
        model="gpt-5.5",
        instructions="You are a helpful coding tutor. Explain concepts clearly with examples.",
        input="How do I handle exceptions in Python?"
    )

    print(response.output_text)

if __name__ == "__main__":
    main()
```

## Built-in Web Search

```python
import os
from openai import OpenAI

def main():
    client = OpenAI(api_key=os.environ["APERTIS_API_KEY"], base_url="https://api.apertis.ai/v1")

    response = client.responses.create(
        model="gpt-5.5",
        input="What are the latest news about AI regulations?",
        tools=[{"type": "web_search"}]
    )

    print(response.output_text)

    # Access search results if available
    for item in response.output:
        if item.type == "web_search_call":
            print(f"\nSearch query: {getattr(item.action, 'query', None)}")

if __name__ == "__main__":
    main()
```

## Code Interpreter

```python
import os
from openai import OpenAI

def main():
    client = OpenAI(api_key=os.environ["APERTIS_API_KEY"], base_url="https://api.apertis.ai/v1")

    response = client.responses.create(
        model="gpt-5.5",
        input="Calculate the compound interest on $10,000 at 5% annual rate for 10 years, compounded monthly. Show the calculation.",
        tools=[{"type": "code_interpreter"}]
    )

    print(response.output_text)

if __name__ == "__main__":
    main()
```

## Function Calling

```python
import json
import os
from openai import OpenAI

def main():
    client = OpenAI(api_key=os.environ["APERTIS_API_KEY"], base_url="https://api.apertis.ai/v1")

    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get current weather for a location",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {"type": "string", "description": "City name"},
                        "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}
                    },
                    "required": ["location"]
                }
            }
        }
    ]

    response = client.responses.create(
        model="gpt-5.5",
        input="What's the weather in London?",
        tools=tools
    )

    for item in response.output:
        if item.type == "function_call":
            print(f"Function: {item.name}")
            print(f"Arguments: {json.dumps(json.loads(item.arguments), indent=2)}")
        elif item.type == "message":
            print(f"Message: {item.content}")

if __name__ == "__main__":
    main()
```

## Streaming

```python
import os
from openai import OpenAI

def main():
    client = OpenAI(api_key=os.environ["APERTIS_API_KEY"], base_url="https://api.apertis.ai/v1")

    stream = client.responses.create(
        model="gpt-5.5",
        input="Write a short story about a robot learning to paint.",
        stream=True
    )

    for event in stream:
        if event.type == "response.output_text.delta":
            print(event.delta, end="", flush=True)

    print()

if __name__ == "__main__":
    main()
```

## Image Input

```python
import os
from openai import OpenAI

def main():
    client = OpenAI(api_key=os.environ["APERTIS_API_KEY"], base_url="https://api.apertis.ai/v1")

    response = client.responses.create(
        model="gpt-5.5",
        input=[
            {
                "type": "message",
                "role": "user",
                "content": [
                    {"type": "input_text", "text": "What's in this image?"},
                    {
                        "type": "input_image",
                        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg"
                    }
                ]
            }
        ]
    )

    print(response.output_text)

if __name__ == "__main__":
    main()
```

## Response with Reasoning

```python
import os
from openai import OpenAI

def main():
    client = OpenAI(api_key=os.environ["APERTIS_API_KEY"], base_url="https://api.apertis.ai/v1")

    response = client.responses.create(
        model="gpt-5.5",
        input="Solve: If 3x + 7 = 22, what is x? Show your reasoning.",
        reasoning={"effort": "high"}
    )

    # Access reasoning if available
    for item in response.output:
        if item.type == "reasoning":
            print("=== Reasoning ===")
            print(item.content)
        elif item.type == "message":
            print("\n=== Answer ===")
            print(item.content)

if __name__ == "__main__":
    main()
```

## Response Metadata

```python
import os
from openai import OpenAI

def main():
    client = OpenAI(api_key=os.environ["APERTIS_API_KEY"], base_url="https://api.apertis.ai/v1")

    response = client.responses.create(
        model="gpt-5.5",
        input="Hello, world!"
    )

    print(f"Response ID: {response.id}")
    print(f"Model: {response.model}")
    print(f"Status: {response.status}")
    print(f"Input Tokens: {response.usage.input_tokens}")
    print(f"Output Tokens: {response.usage.output_tokens}")
    print(f"\nOutput: {response.output_text}")

if __name__ == "__main__":
    main()
```

## Async Responses API

```python
import asyncio
import os
from openai import AsyncOpenAI

async def main():
    client = AsyncOpenAI(api_key=os.environ["APERTIS_API_KEY"], base_url="https://api.apertis.ai/v1")

    response = await client.responses.create(
        model="gpt-5.5",
        input="What is quantum computing?"
    )

    print(response.output_text)

if __name__ == "__main__":
    asyncio.run(main())
```

## Context Compression

Reduce token usage for long conversations by enabling [context compression](/api/text-generation/context-compression). Apertis compresses older conversation history using a lightweight model before forwarding to the target model.

```python
import os
from openai import OpenAI

def main():
    client = OpenAI(api_key=os.environ["APERTIS_API_KEY"], base_url="https://api.apertis.ai/v1")

    response = client.responses.create(
        model="o4-mini-high",
        input=[
            {"role": "user", "content": "Explain distributed systems"},
            {"role": "assistant", "content": "Distributed systems are..."},
            # ... many turns of conversation history ...
            {"role": "user", "content": "Summarize the key points"}
        ],
        extra_body={
            "compression": {
                "enabled": True,
                "strategy": "on",        # "on", "conservative", "aggressive"
                "model": "gpt-5.4-mini"  # or "auto" for automatic selection
            }
        }
    )

    print(response.output_text)

if __name__ == "__main__":
    main()
```

## Supported Models

The Responses API supports:

| Provider | Models |
|----------|--------|
| OpenAI | `gpt-5.5`, `gpt-5.4-mini`, `o4-mini-high`, `o3-mini-high` |
| Others | Models with Responses API compatibility |

[View all models →](/api/utilities/models)

## API Reference

### Request Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | `str` | Model identifier (required) |
| `input` | `str \| list` | User input or conversation (required) |
| `instructions` | `str` | System instructions |
| `tools` | `list` | Tool definitions |
| `temperature` | `float` | Sampling temperature |
| `max_output_tokens` | `int` | Maximum tokens to generate |
| `stream` | `bool` | Enable streaming |
| `reasoning` | `dict` | Reasoning configuration |

### Built-in Tools

| Tool | Description |
|------|-------------|
| `web_search` | Real-time web search |
| `code_interpreter` | Execute code and analyze data |
| `file_search` | Search through uploaded files |

### Response Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | `str` | Response ID |
| `model` | `str` | Model used |
| `status` | `str` | Response status |
| `output` | `list` | Output items |
| `output_text` | `str` | Concatenated text output |
| `usage` | `object` | Token usage |
