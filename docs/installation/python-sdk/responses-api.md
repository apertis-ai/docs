# Responses API

Use OpenAI's Responses API format for enhanced capabilities including built-in tools, web search, and file handling.

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

    response = client.responses.create(
        model="gpt-4o",
        input="Explain the concept of machine learning."
    )

    print(response.output_text)

if __name__ == "__main__":
    main()
```

## Multi-Turn with Input Items

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.responses.create(
        model="gpt-4o",
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
from apertis import Apertis

def main():
    client = Apertis()

    response = client.responses.create(
        model="gpt-4o",
        instructions="You are a helpful coding tutor. Explain concepts clearly with examples.",
        input="How do I handle exceptions in Python?"
    )

    print(response.output_text)

if __name__ == "__main__":
    main()
```

## Built-in Web Search

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.responses.create(
        model="gpt-4o",
        input="What are the latest news about AI regulations?",
        tools=[{"type": "web_search"}]
    )

    print(response.output_text)

    # Access search results if available
    for item in response.output:
        if item.type == "web_search_call":
            print(f"\nSearch query: {item.query}")

if __name__ == "__main__":
    main()
```

## Code Interpreter

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.responses.create(
        model="gpt-4o",
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
from apertis import Apertis

def main():
    client = Apertis()

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
        model="gpt-4o",
        input="What's the weather in London?",
        tools=tools
    )

    for item in response.output:
        if item.type == "function_call":
            print(f"Function: {item.name}")
            print(f"Arguments: {json.dumps(item.arguments, indent=2)}")
        elif item.type == "message":
            print(f"Message: {item.content}")

if __name__ == "__main__":
    main()
```

## Streaming

```python
from apertis import Apertis

def main():
    client = Apertis()

    stream = client.responses.create(
        model="gpt-4o",
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
from apertis import Apertis

def main():
    client = Apertis()

    response = client.responses.create(
        model="gpt-4o",
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
from apertis import Apertis

def main():
    client = Apertis()

    response = client.responses.create(
        model="o1",
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
from apertis import Apertis

def main():
    client = Apertis()

    response = client.responses.create(
        model="gpt-4o",
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
from apertis import AsyncApertis

async def main():
    client = AsyncApertis()

    response = await client.responses.create(
        model="gpt-4o",
        input="What is quantum computing?"
    )

    print(response.output_text)

if __name__ == "__main__":
    asyncio.run(main())
```

## Supported Models

The Responses API supports:

| Provider | Models |
|----------|--------|
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `o1`, `o1-mini`, `o3-mini` |
| Others | Models with Responses API compatibility |

[View all models →](/references/models)

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
