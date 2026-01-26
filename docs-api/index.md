---
sidebar_position: 1
title: API Reference
description: Complete API reference documentation for Apertis AI
---

# API Reference

Welcome to the Apertis API Reference. This documentation covers all available API endpoints, SDKs, and integration guides.

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
