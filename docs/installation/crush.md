# Crush

Crush is a terminal-based AI coding agent (CLI + TUI) that supports multiple models for code generation, debugging, and file operations.

## Features

- **Code Generation**: Generate code from natural language
- **Debugging**: Identify and fix issues in your code
- **File Operations**: Create and modify files
- **Technical Q&A**: Get answers to programming questions
- **TUI Interface**: Interactive terminal user interface

## Installation

### Homebrew (macOS)

```bash
brew install charmbracelet/tap/crush
```

### NPM (Cross-Platform)

```bash
npm install -g @charmland/crush
```

### Arch Linux

```bash
yay -S crush-bin
```

### Nix

```bash
nix run github:numtide/nix-ai-tools#crush
```

## Configuration for Apertis API

### Step 1: Get API Key

Obtain your API key from [Apertis Dashboard](https://apertis.ai/token).

### Step 2: Configure crush.json

Create or edit the configuration file:

**Location:**
- macOS/Linux: `~/.config/crush/crush.json`
- Windows: `%USERPROFILE%\.config\crush\crush.json`

**Configuration:**

```json
{
  "providers": {
    "apertis": {
      "id": "apertis",
      "name": "Apertis Provider",
      "base_url": "https://api.apertis.ai/v1",
      "api_key": "your_apertis_api_key"
    }
  }
}
```

Replace `your_apertis_api_key` with your actual API key.

### Step 3: Launch Crush

```bash
crush
```

### Step 4: Switch Model

Press `Ctrl+P` and select "Switch Model" to choose your preferred model.

## Available Models

| Model | Name |
|-------|------|
| Claude 3.5 Sonnet | `claude-3-5-sonnet-20241022` |
| Claude 3.5 Haiku | `claude-3-5-haiku-20241022` |
| GPT-4o | `gpt-4o` |
| GPT-4o mini | `gpt-4o-mini` |
| Gemini 2.0 Flash | `gemini-2.0-flash-exp` |

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Switch Model | `Ctrl+P` |
| New Chat | `Ctrl+N` |
| Quit | `Ctrl+C` |

## MCP Integration

Crush supports Model Context Protocol servers:

- **Vision Server**: Analyze images and screenshots
- **Web Search Server**: Search the web for information
- **Web Reader Server**: Extract content from web pages

## Troubleshooting

### Configuration Not Working

- Verify the config file location is correct
- Check JSON syntax is valid
- Ensure API key has no extra spaces

### Connection Issues

- Verify your API key at [Apertis Dashboard](https://apertis.ai/token)
- Ensure the Base URL is `https://api.apertis.ai/v1`
- Check your network connection

## Related Resources

- [Model List](https://apertis.ai/models)
- [API Keys Management](https://apertis.ai/token)
- [Claude Code](/installation/claude-code) - Alternative terminal AI coding tool
- [OpenCode](/installation/opencode) - Another CLI AI coding agent
