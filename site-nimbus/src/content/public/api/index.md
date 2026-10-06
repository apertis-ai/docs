# API Reference

Welcome to the Apertis API Reference. This documentation covers all available API endpoints, SDKs, and integration guides.

## Choosing an API format

The gateway accepts text generation requests in three formats: Chat Completions, Responses, and Messages. If you're not sure which to use, start with Chat Completions — it's the format the Python SDK's own quick start uses.

| | Chat Completions | Responses | Messages |
|---|---|---|---|
| Endpoint path | `/v1/chat/completions` | `/v1/responses` | `/v1/messages` |
| Compatible SDK | OpenAI SDK (`chat.completions.create`, `base_url` ends in `/v1`) or the Apertis SDK | OpenAI SDK (`responses.create`, `base_url` ends in `/v1`) or the Apertis SDK | Anthropic SDK (`messages.create`, `base_url` has no `/v1`) or the Apertis SDK |
| Best for | OpenAI-compatible chat API | Models that only support `/v1/responses` (e.g. `gpt-5-pro`, `o1-pro`, `codex-mini`); built-in tools; stateful multi-turn | Claude models only, via Anthropic-type channels |
| Streaming | `stream: true` | `stream: true` | `stream: true`, with `message_start` / `content_block_delta` / `message_stop` SSE events |
| Tool calling | `tools`, `tool_choice`, `parallel_tool_calls` | `tools`, `tool_choice`, `max_tool_calls`, `parallel_tool_calls`, plus built-in `web_search`, `code_interpreter`, `file_search` | `tools`, `tool_choice` |
| Reasoning / thinking | `reasoning_effort` string; Claude `thinking` via `extra_body`; DeepSeek returns `reasoning_content` | `reasoning` object (`effort`, `summary`) | `thinking` object (`type`, `budget_tokens`) |
| Prompt caching | See [Prompt Cache](/api/text-generation/prompt-cache) | See [Prompt Cache](/api/text-generation/prompt-cache) | See [Prompt Cache](/api/text-generation/prompt-cache) |
| Structured output | `response_format` with `json_schema` | `text.format` | `response_format` (OpenAI-compatible extended parameter) |

- Pick [Chat Completions](/api/text-generation/chat-completions) if you're already using an OpenAI-compatible client and the standard `messages` array.
- Pick [Responses](/api/text-generation/responses) if your model only supports `/v1/responses`, or you need built-in tools or stateful multi-turn via `previous_response_id`.
- Pick [Messages](/api/text-generation/messages) if you're calling Claude models directly and want the native Anthropic SDK and extended thinking.

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
