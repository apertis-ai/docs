# Chat Completions

Generate text responses using chat-based models with the familiar OpenAI-compatible interface.

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

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "user", "content": "Explain quantum computing in simple terms."}
        ]
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Multi-Turn Conversations

```python
from apertis import Apertis

def main():
    client = Apertis()

    messages = [
        {"role": "system", "content": "You are a helpful Python tutor."},
        {"role": "user", "content": "What is a list comprehension?"},
    ]

    response = client.chat.completions.create(
        model="claude-sonnet-4.5",
        messages=messages
    )

    print("Assistant:", response.choices[0].message.content)

    # Continue the conversation
    messages.append({"role": "assistant", "content": response.choices[0].message.content})
    messages.append({"role": "user", "content": "Can you show me an example?"})

    response = client.chat.completions.create(
        model="claude-sonnet-4.5",
        messages=messages
    )

    print("\nAssistant:", response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Configuration Options

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "user", "content": "Write a creative story opening."}
        ],
        temperature=0.9,      # Higher = more creative (0.0 - 2.0)
        max_tokens=500,       # Maximum response length
        top_p=0.95,           # Nucleus sampling
        frequency_penalty=0.5, # Reduce repetition
        presence_penalty=0.5,  # Encourage new topics
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Response Format

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "user", "content": "Hello!"}
        ]
    )

    # Access response data
    print(f"Model: {response.model}")
    print(f"Content: {response.choices[0].message.content}")
    print(f"Role: {response.choices[0].message.role}")
    print(f"Finish Reason: {response.choices[0].finish_reason}")

    # Token usage
    print(f"\nPrompt Tokens: {response.usage.prompt_tokens}")
    print(f"Completion Tokens: {response.usage.completion_tokens}")
    print(f"Total Tokens: {response.usage.total_tokens}")

if __name__ == "__main__":
    main()
```

## Supported Models

All chat-capable models are supported, including:

| Provider | Models |
|----------|--------|
| OpenAI | `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1`, `o1`, `o3-mini` |
| Anthropic | `claude-sonnet-4.5`, `claude-opus-4-5-20251101`, `claude-haiku-4-5-20250501` |
| Google | `gemini-3-pro-preview`, `gemini-2.5-flash` |
| DeepSeek | `deepseek-chat`, `deepseek-reasoner` |
| xAI | `grok-3`, `grok-3-fast` |

[View all models →](/api/utilities/models)

## API Reference

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | `str` | Model identifier (required) |
| `messages` | `list` | Conversation messages (required) |
| `temperature` | `float` | Sampling temperature (0.0 - 2.0) |
| `max_tokens` | `int` | Maximum tokens to generate |
| `top_p` | `float` | Nucleus sampling parameter |
| `frequency_penalty` | `float` | Repetition penalty (-2.0 - 2.0) |
| `presence_penalty` | `float` | Topic diversity penalty (-2.0 - 2.0) |
| `stop` | `list[str]` | Stop sequences |
| `n` | `int` | Number of completions to generate |
