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
curl https://api.apertis.ai/v1/chat/completions \
  -H "Authorization: Bearer $APERTIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini:web",
    "messages": [
      {"role": "user", "content": "What is the stock price of Apple today?"}
    ],
    "max_tokens": 100
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
    {"role": "user", "content": "What is the stock price of Apple today?"}
  ],
  "max_tokens": 100,
  "web_results_count": 5,
  "web_content_length": "medium"
}
```

## Response Format

The response includes a `web_sources` array listing all referenced sources:

```json
{
  "model": "gpt-4o-mini",
  "system_fingerprint": "fp_f97eff32c5",
  "choices": [
    {
      "index": 0,
      "finish_reason": "stop",
      "message": {
        "role": "assistant",
        "content": "As of January 6, 2026, the stock price of Apple (NASDAQ: AAPL) is $262.36, reflecting a decline of $4.90 from the previous day [1]."
      }
    }
  ],
  "usage": {
    "prompt_tokens": 1265,
    "completion_tokens": 43,
    "total_tokens": 1308
  },
  "web_sources": [
    {
      "title": "Stock Price - Apple Investor Relations",
      "url": "https://investor.apple.com/stock-price/default.aspx",
      "snippet": "Stock Price - Apple\nJanuary 6, 2026 4:00 p.m. ET..."
    },
    {
      "title": "NASDAQ:AAPL Stock Price — TradingView",
      "url": "https://www.tradingview.com/symbols/NASDAQ-AAPL/",
      "snippet": "Apple Stock Chart — NASDAQ:AAPL Stock Price..."
    },
    {
      "title": "Apple Stock Price Today | NASDAQ: AAPL Live - Investing.com",
      "url": "https://www.investing.com/equities/apple-computer-inc",
      "snippet": "Apple Stock Price Today | NASDAQ: AAPL Live..."
    },
    {
      "title": "AAPL Stock Price | Apple Inc. Stock Quote | MarketWatch",
      "url": "https://www.marketwatch.com/investing/stock/aapl",
      "snippet": "AAPL Stock Price | Apple Inc. Stock Quote..."
    }
  ],
  "error": {
    "message": "",
    "type": "",
    "param": "",
    "code": null
  }
}
```

## Streaming Mode

When using streaming mode with `"stream": true`, a search indicator appears first, followed by the model response chunks:

### Streaming Request

```json
{
  "model": "gpt-4o-mini:web",
  "messages": [
    {"role": "user", "content": "What is the weather in Tokyo today?"}
  ],
  "max_tokens": 80,
  "stream": true
}
```

### Streaming Response

```
data: {"id":"web-search","object":"chat.completion.chunk","created":1768287477,"model":"","choices":[{"index":0,"delta":{"role":"assistant","content":"🔍 Web searching...\n\n"}}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1768287475,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"role":"assistant","content":""}}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1768287475,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":"The"}}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1768287475,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":" weather"}}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1768287475,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":" in"}}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1768287475,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":" Tokyo"}}]}

...

data: [DONE]
```

The first chunk contains the `🔍 Web searching...` indicator with `id: "web-search"`, followed by regular streaming chunks from the model.

## HTTP Headers

The response includes these HTTP headers for monitoring web search status:

| Header | Description |
|--------|-------------|
| `X-Web-Search-Used` | `true` or `false`, indicates whether web search was used |
| `X-Web-Search-Count` | Number of search results retrieved |
| `X-Web-Search-Status` | Search status: `success`, `failed`, or `no_results` |

Example response headers:
```
x-web-search-used: true
x-web-search-count: 5
x-web-search-status: success
```

## Use Cases

### 1. Real-Time Information

Query current news, stock prices, weather, and other real-time information:

```bash
curl https://api.apertis.ai/v1/chat/completions \
  -H "Authorization: Bearer $APERTIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini:web",
    "messages": [
      {"role": "user", "content": "What is the latest news about AI?"}
    ],
    "max_tokens": 150
  }'
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

:::tip Token Usage
When web search is enabled, the `prompt_tokens` in the response will be higher than a regular request because the search results are injected into the system message. In the example above, the prompt tokens increased from ~13 (without search) to ~1265 (with search results injected).
:::

## Error Handling

When web search fails, the system automatically falls back to non-search mode and continues using the base model to respond. You can check the search status via the `X-Web-Search-Status` header:

- `success`: Web search completed successfully
- `failed`: Web search failed, fell back to non-search mode
- `no_results`: Web search returned no results, fell back to non-search mode

## Best Practices

1. **Clear questions**: The more specific the question, the more accurate the search results
2. **Appropriate result count**: For general queries, 3-5 results are usually sufficient
3. **Choose appropriate content length**:
   - `short`: Quick summaries
   - `medium`: Balance between detail and speed (default)
   - `full`: Use when complete context is needed
4. **Check sources**: Use `web_sources` in the response to verify information sources
5. **Monitor headers**: Check `X-Web-Search-Status` to confirm search was successful
