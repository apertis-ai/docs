---
sidebar_position: 1
title: API Reference
description: Complete API reference documentation for Apertis AI
---

# API Reference

Welcome to the Apertis API Reference. This documentation covers all available API endpoints, SDKs, and integration guides.

## Choosing an API format

The gateway accepts text generation requests in three formats: Chat Completions, Responses, and Messages. If you're not sure which to use, start with Chat Completions — it's the format the Python SDK's own quick start uses.

| | Chat Completions | Responses | Messages |
|---|---|---|---|
| Endpoint path | `/v1/chat/completions` | `/v1/responses` | `/v1/messages` |
| Compatible SDK | OpenAI SDK (`chat.completions.create`) | OpenAI SDK (`responses.create`) | Anthropic SDK (`messages.create`) |
| Best for | OpenAI-compatible chat API | Built-in tools (web search, code interpreter, file search), stateful multi-turn, and OpenAI reasoning models | Native Anthropic format with Claude-specific features |
| Streaming | `stream: true` | `stream: true` | `stream: true`, with `message_start` / `content_block_delta` / `message_stop` SSE events |
| Tool calling | `tools`, `tool_choice`, `parallel_tool_calls` | `tools`, `tool_choice`, `max_tool_calls`, `parallel_tool_calls`, plus built-in `web_search`, `code_interpreter`, `file_search` | `tools`, `tool_choice` |
| Reasoning / thinking | Reasoning models return content directly (e.g. `o1`); `reasoning_content` for DeepSeek models; `thinking` via `extra_body` for Claude models | `reasoning` object (`effort`, `summary`) | `thinking` object (`type`, `budget_tokens`) |
| Prompt caching | See [Prompt Cache](/api/text-generation/prompt-cache) | See [Prompt Cache](/api/text-generation/prompt-cache) | See [Prompt Cache](/api/text-generation/prompt-cache) |
| Structured output | `response_format` with `json_schema` | `text.format` | `response_format` (OpenAI-compatible extended parameter) |

Pick Chat Completions if you're already using an OpenAI-compatible client and the standard `messages` array. Pick Responses if you need built-in tools, stateful multi-turn via `previous_response_id`, or OpenAI's reasoning models. Pick Messages if you're calling Claude models directly and want the native Anthropic SDK and extended thinking.

- [Chat Completions](/api/text-generation/chat-completions)
- [Responses API](/api/text-generation/responses)
- [Messages API](/api/text-generation/messages)

## Quick Links

### Text Generation
- [Chat Completions](/api/text-generation/chat-completions) - OpenAI-compatible chat API
- [Responses API](/api/text-generation/responses) - OpenAI Responses format
- [Messages API](/api/text-generation/messages) - Anthropic Messages format

### Multimodal
- [Vision](/api/vision/read-image) - Image understanding
- [Image Generation](/api/vision/image-generation) - Create images with AI
- [Audio](/api/audio-video/audio) - Speech-to-text and text-to-speech
- [Video](/api/audio-video/video) - Video understanding

### Utilities
- [Billing Credits](/api/utilities/billing-credits) - Check remaining credits and subscription quota

### SDKs & Libraries
- [Python SDK](/api/sdks/python-sdk) - Official Python client
- [AI SDK Provider](/api/sdks/ai-sdk-provider) - Vercel AI SDK integration
- [LangChain](/api/sdks/langchain) - LangChain integration
- [LlamaIndex](/api/sdks/llamaindex) - LlamaIndex integration
- [LiteLLM](/api/sdks/litellm) - LiteLLM proxy support

## Base URL

All API requests should be made to:

```
https://api.apertis.ai/v1
```

## Authentication

Include your API key in the `Authorization` header:

```bash
Authorization: Bearer YOUR_API_KEY
```

See [API Keys](/authentication/api-keys) for details on obtaining and managing your API keys.
