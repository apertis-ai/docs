# Base URL and API Key Connection Guide

Apertis AI provides `BASE_URL` and `API Key` configurations for integrating with custom projects. Different applications may require different `BASE_URL` options.

### BASE_URL

The following three connection endpoints are available:

- **[https://api.apertis.ai](https://api.apertis.ai)**
- **[https://api.apertis.ai/v1](https://api.apertis.ai/v1)**
- **[https://api.apertis.ai/v1/chat/completions](https://api.apertis.ai/v1/chat/completions)**

### Anthropic-compatible endpoint

Anthropic SDKs and tools such as Claude Code use the base URL `https://api.apertis.ai` and send requests to `/v1/messages` (the SDK appends the path). See the [Messages API](../api/text-generation/messages) for the full request format.

A failed request can retry on another channel.

### API Key

Visit **[Apertis](https://apertis.ai/setting?tab=keys)** to obtain your `API Key`.

To limit what a key can use, see [Model Restrictions](../authentication/api-keys.md#model-restrictions) and the other key settings in [API Keys](../authentication/api-keys.md), and [Per-Key Limits](../billing/per-key-limits.md).
