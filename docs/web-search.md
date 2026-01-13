---
sidebar_position: 4
---

# Web Search

Enable real-time web search for any model by adding the `:web` suffix to the model name. The system automatically searches for relevant information and integrates it into the response.

:::warning Note
Web search is only available for non-free models. Free models (e.g., `gpt-4o-mini:free`) do not support the `:web` suffix and will return an error.
:::

## Quick Start

Simply append `:web` to any model ID:

```bash
curl https://api.stima.tech/v1/chat/completions \
  -H "Authorization: Bearer $STIMA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini:web",
    "messages": [
      {"role": "user", "content": "Who won the 2024 Nobel Prize in Physics?"}
    ]
  }'
```

## Supported Models

All non-free models support the `:web` suffix:

| Provider | Example Models |
|----------|----------------|
| OpenAI | `gpt-4o:web`, `gpt-4o-mini:web`, `o1-preview:web` |
| Anthropic | `claude-3-5-sonnet-20241022:web`, `claude-opus-4-5-20251101:web` |
| Google | `gemini-1.5-pro:web`, `gemini-1.5-flash:web` |
| Others | Any available non-free model can use `:web` |

## Request Parameters

In addition to standard Chat Completions parameters, you can use these web search specific parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `web_results_count` | integer | 5 | Number of search results to retrieve (1-10) |
| `web_content_length` | string | "medium" | Content length: `short`, `medium`, or `full` |

### Example Request

```json
{
  "model": "gpt-4o-mini:web",
  "messages": [
    {"role": "user", "content": "What are the new features in React 19?"}
  ],
  "web_results_count": 5,
  "web_content_length": "medium"
}
```

## Response Format

The response includes a `web_sources` array listing all referenced sources:

```json
{
  "id": "chatcmpl-xxx",
  "model": "gpt-4o-mini",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "The 2024 Nobel Prize in Physics was awarded jointly to John Hopfield and Geoffrey Hinton..."
      }
    }
  ],
  "web_sources": [
    {
      "title": "2024 Nobel Prize in Physics",
      "url": "https://www.nobelprize.org/prizes/physics/2024/",
      "snippet": "The Nobel Prize in Physics 2024 was awarded jointly to John J. Hopfield and Geoffrey E. Hinton..."
    },
    {
      "title": "Nobel Prize in Physics - Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Nobel_Prize_in_Physics",
      "snippet": "The 2024 Nobel Prize in Physics was awarded to pioneers of artificial neural networks..."
    }
  ]
}
```

## Streaming Mode

When using streaming mode, a search indicator message appears first, followed by the model response:

```
data: {"choices":[{"delta":{"content":"🔍 Web searching...\n\n"}}]}

data: {"choices":[{"delta":{"content":"Based on the search results..."}}]}

...

data: {"web_sources":[{"title":"...","url":"...","snippet":"..."}]}

data: [DONE]
```

## HTTP Headers

The response includes these HTTP headers:

| Header | Description |
|--------|-------------|
| `X-Web-Search-Used` | `true` or `false`, indicates whether web search was used |
| `X-Web-Search-Count` | Number of search results retrieved |
| `X-Web-Search-Status` | Search status: `success`, `failed`, or `no_results` |

## Use Cases

### 1. Real-Time Information

Query current news, stock prices, weather, and other real-time information:

```json
{
  "model": "gpt-4o:web",
  "messages": [
    {"role": "user", "content": "What is TSMC's stock price today?"}
  ]
}
```

### 2. Technical Documentation

Query the latest technical documentation or API updates:

```json
{
  "model": "claude-3-5-sonnet-20241022:web",
  "messages": [
    {"role": "user", "content": "How do I use Server Actions in Next.js 15?"}
  ],
  "web_results_count": 8,
  "web_content_length": "full"
}
```

### 3. Academic Research

Search for the latest research papers or academic information:

```json
{
  "model": "gemini-1.5-pro:web",
  "messages": [
    {"role": "user", "content": "What are the important findings in 2024 research on large language models?"}
  ]
}
```

## Billing

- **Search costs**: Absorbed by the platform, no additional charge to users
- **Model costs**: Only the final response token usage is counted
- **Query generation**: Internal query generation is not counted against user quota

## Error Handling

When web search fails, the system automatically falls back to non-search mode and continues using the base model to respond. You can check the search status via the `X-Web-Search-Status` header.

## Best Practices

1. **Clear questions**: The more specific the question, the more accurate the search results
2. **Appropriate result count**: For general queries, 3-5 results are usually sufficient
3. **Choose appropriate content length**:
   - `short`: Quick summaries
   - `medium`: Balance between detail and speed
   - `full`: Use when complete context is needed
4. **Check sources**: Use `web_sources` in the response to verify information sources
