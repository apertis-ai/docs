# OpenCode

OpenCode is an AI coding agent that provides both CLI and IDE integration capabilities for AI-powered development tasks.

## Features

- **CLI Access**: Run AI coding tasks directly from terminal
- **IDE Integration**: Works with VS Code, Cursor, and compatible editors
- **GitHub Integration**: Interact with issues and PRs via comments
- **Conversation Sharing**: Share coding sessions with others
- **MCP Support**: Enhanced functionality through MCP servers

## Installation

### Method 1: Install Script (Recommended)

```bash
curl -fsSL https://opencode.ai/install | bash
```

### Method 2: NPM

```bash
npm install -g opencode-ai
```

## Configuration for Apertis API

Create or edit the configuration file at `~/.config/opencode/opencode.json`:

### Option 1: Using Apertis SDK (Recommended)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "apertis": {
      "name": "Apertis AI",
      "npm": "@apertis/ai-sdk-provider",
      "options": {
        "apiKey": "your_apertis_api_key"
      },
      "models": {
        "claude-opus-4-8-thinking": {
          "name": "Claude Opus 4.8 (Thinking)"
        },
        "claude-opus-4-8": {
          "name": "Claude Opus 4.8"
        },
        "claude-sonnet-4-6": {
          "name": "Claude Sonnet 4.6"
        },
        "claude-haiku-4-5": {
          "name": "Claude Haiku 4.5"
        },
        "gemini-3.1-pro-preview": {
          "name": "Gemini 3.1 Pro Preview"
        },
        "gemini-3.1-flash-lite-preview": {
          "name": "Gemini 3.1 Flash Lite Preview"
        }
      }
    }
  },
  "model": "apertis/claude-opus-4-8"
}
```

### Option 2: Without SDK (OpenAI-Compatible)

If you prefer not to use the Apertis SDK, you can use the built-in OpenAI-compatible mode by specifying `baseURL`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "apertis": {
      "name": "Apertis AI",
      "options": {
        "baseURL": "https://api.apertis.ai/v1",
        "apiKey": "your_apertis_api_key"
      },
      "models": {
        "claude-opus-4-8": {
          "name": "Claude Opus 4.8"
        },
        "claude-sonnet-4-6": {
          "name": "Claude Sonnet 4.6"
        }
      }
    }
  },
  "model": "apertis/claude-opus-4-8"
}
```

Replace `your_apertis_api_key` with your actual API key from [Apertis Dashboard](https://apertis.ai/setting?tab=keys).

> **Tip: No `code:` prefix needed**
>
> Unlike Claude Code, OpenCode does **not** require the `code:` prefix for Claude model IDs. Use the standard model ID directly (e.g., `claude-opus-4-8` instead of `code:claude-opus-4-8`).

### Configuration Fields

| Field | Description |
|-------|-------------|
| `provider.apertis.npm` | Apertis SDK package. Use `@apertis/ai-sdk-provider` for automatic setup. |
| `provider.apertis.options.baseURL` | Apertis API endpoint. Only needed without the SDK. |
| `provider.apertis.options.apiKey` | Your API key from [Apertis Dashboard](https://apertis.ai/setting?tab=keys). |
| `provider.apertis.models` | Available models to use. Add or remove as needed. |
| `model` | Default model on launch. Format: `apertis/<model-id>`. |

### Available Model IDs

| Model ID | Description |
|----------|-------------|
| `claude-opus-4-8-thinking` | Claude Opus 4.8 with extended thinking |
| `claude-opus-4-8` | Claude Opus 4.8 — most capable |
| `claude-sonnet-4-6` | Claude Sonnet 4.6 — balanced speed and capability |
| `claude-haiku-4-5` | Claude Haiku 4.5 — fastest |
| `gemini-3.1-pro-preview` | Gemini 3.1 Pro Preview |
| `gemini-3.1-flash-lite-preview` | Gemini 3.1 Flash Lite Preview |

For the full list of available models, check the [Model List](https://apertis.ai/models).

### Launch OpenCode

```bash
opencode
```

Use the `/models` command within OpenCode to switch models.

## Open models

Copy this into `~/.config/opencode/opencode.json`, and set `APERTIS_API_KEY` to a key from the [API Keys](https://apertis.ai/setting?tab=keys) page first (`export APERTIS_API_KEY="<your Apertis API key>"`). It uses the `providers` format from OpenCode's [providers guide](https://opencode.ai/docs/providers/).

```json
{
  "$schema": "https://opencode.ai/config.json",
  "providers": {
    "apertis": {
      "name": "Apertis",
      "env": ["APERTIS_API_KEY"],
      "package": "@opencode/ai/providers/openai-compatible",
      "settings": {
        "baseURL": "https://api.apertis.ai/v1"
      },
      "models": {
        "glm-5.1": { "name": "GLM 5.1" },
        "kimi-k2.6": { "name": "Kimi K2.6" },
        "deepseek-v3.2": { "name": "DeepSeek V3.2" },
        "minimax-m2.5": { "name": "MiniMax M2.5" },
        "qwen3-coder-next": { "name": "Qwen3 Coder Next" }
      }
    }
  },
  "model": "apertis/glm-5.1"
}
```

If your file already defines an `apertis` provider, add these model IDs to that entry instead of adding a second one.

These IDs were checked against the public model catalog on 2026-11-08. The developers of these model families publish their weights. For the current list, see the [Model List](https://apertis.ai/models).

## IDE Integration

OpenCode works with VS Code, Cursor, and compatible terminals.

### Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Quick Launch | `Cmd+Esc` | `Ctrl+Esc` |
| New Session | `Cmd+Shift+Esc` | `Ctrl+Shift+Esc` |
| File References | `Cmd+Option+K` | `Alt+Ctrl+K` |

## Commands

| Command | Description |
|---------|-------------|
| `/models` | Select AI model |
| `/share` | Create public conversation link |
| `/unshare` | Remove public access |
| `/help` | Show available commands |

## GitHub Integration

Interact with OpenCode directly in GitHub issues and pull requests.

### Setup

Run this command in your GitHub repository:

```bash
opencode github install
```

### Usage

Comment with `/opencode` or `/oc` in GitHub issues/PRs to:

- **Explain Issues**: Get AI explanations for bug reports
- **Fix Bugs**: Generate fixes for reported issues
- **Implement Features**: Create code for feature requests
- **Review PRs**: Get AI-powered code reviews

## MCP Server Support

OpenCode supports Model Context Protocol servers:

- **Vision Server**: Analyze images and screenshots
- **Web Search Server**: Search the web for information
- **Web Reader Server**: Extract content from web pages

## Troubleshooting

### Connection Issues

- Verify your API key at [Apertis Dashboard](https://apertis.ai/setting?tab=keys)
- Ensure the Base URL is set correctly
- Check environment variables are exported

### Authentication Problems

Reset authentication and reconfigure:

```bash
opencode auth logout
opencode auth login
```

## Related Resources

- [Model List](https://apertis.ai/models)
- [API Keys Management](https://apertis.ai/setting?tab=keys)
- [Claude Code](/installation/claude-code) - Alternative terminal AI coding tool
- [OpenCode Documentation](https://opencode.ai/docs)
