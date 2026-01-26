# Web Search

Enable AI models to search the web in real-time, providing up-to-date information with citations and source attribution.

## Prerequisites

```bash
pip install apertis
```

Get your API Key from [**Apertis**](https://apertis.ai/token)

## Basic Web Search

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "user", "content": "What are the latest developments in AI?"}
        ],
        web_search=True
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Web Search with Citations

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "user", "content": "What is the current stock price of Apple?"}
        ],
        web_search=True
    )

    message = response.choices[0].message

    print("Response:", message.content)

    # Access citations if available
    if hasattr(message, 'citations') and message.citations:
        print("\nSources:")
        for citation in message.citations:
            print(f"  - {citation.title}: {citation.url}")

if __name__ == "__main__":
    main()
```

## Factual Questions

```python
from apertis import Apertis

def main():
    client = Apertis()

    questions = [
        "Who won the latest Super Bowl?",
        "What is the current population of Tokyo?",
        "When is the next solar eclipse?",
    ]

    for question in questions:
        response = client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "user", "content": question}
            ],
            web_search=True
        )
        print(f"Q: {question}")
        print(f"A: {response.choices[0].message.content}\n")

if __name__ == "__main__":
    main()
```

## Research Assistant

```python
from apertis import Apertis

def main():
    client = Apertis()

    topic = "quantum computing applications in drug discovery"

    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {
                "role": "system",
                "content": "You are a research assistant. Provide comprehensive, well-cited answers."
            },
            {
                "role": "user",
                "content": f"""Research the following topic and provide:
1. Current state of the field
2. Key players and organizations
3. Recent breakthroughs
4. Future outlook

Topic: {topic}"""
            }
        ],
        web_search=True
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## News Summary

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {
                "role": "user",
                "content": """Summarize today's top technology news. Include:
- Company announcements
- Product launches
- Industry trends
Provide sources for each item."""
            }
        ],
        web_search=True
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Streaming with Web Search

```python
from apertis import Apertis

def main():
    client = Apertis()

    stream = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "user", "content": "What are the current trends in renewable energy?"}
        ],
        web_search=True,
        stream=True
    )

    for chunk in stream:
        if chunk.choices[0].delta.content:
            print(chunk.choices[0].delta.content, end="", flush=True)

    print()

if __name__ == "__main__":
    main()
```

## Competitive Analysis

```python
from apertis import Apertis

def main():
    client = Apertis()

    company = "OpenAI"

    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {
                "role": "user",
                "content": f"""Provide a competitive analysis for {company}:
1. Recent product announcements
2. Market positioning
3. Key competitors
4. Strategic moves
5. Industry perception

Use only current, verifiable information."""
            }
        ],
        web_search=True
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Multi-Turn with Web Search

```python
from apertis import Apertis

def main():
    client = Apertis()

    messages = [
        {"role": "user", "content": "What is the current status of the James Webb Space Telescope?"}
    ]

    # First query
    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=messages,
        web_search=True
    )

    print("Assistant:", response.choices[0].message.content)

    # Follow-up
    messages.append({"role": "assistant", "content": response.choices[0].message.content})
    messages.append({"role": "user", "content": "What are its most recent discoveries?"})

    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=messages,
        web_search=True
    )

    print("\nAssistant:", response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Supported Models

Web search is available on:

| Provider | Models |
|----------|--------|
| OpenAI | `gpt-4.1`, `gpt-4.1-mini` |
| Anthropic | `claude-sonnet-4.5`, `claude-opus-4-5-20251101` |
| Google | `gemini-3-pro-preview`, `gemini-2.5-flash` |

[View all models →](/references/models)

## API Reference

| Parameter | Type | Description |
|-----------|------|-------------|
| `web_search` | `bool` | Enable web search (set to `True`) |

### Citation Object

| Field | Type | Description |
|-------|------|-------------|
| `title` | `str` | Source page title |
| `url` | `str` | Source URL |
| `snippet` | `str` | Relevant excerpt (if available) |

## Best Practices

1. **Be specific** - More specific queries yield better search results
2. **Request citations** - Ask the model to cite sources in its response
3. **Use for current events** - Web search is ideal for recent/real-time information
4. **Verify important facts** - Cross-reference critical information
5. **Consider rate limits** - Web search may have additional rate limiting
