# Claude Code

Claude Code is an agentic terminal tool that understands codebases and accelerates development by automating routine tasks, analyzing complex code, and managing git workflows through natural language commands.

## Prerequisites

- Node.js 18 or newer installed on your system
- Claude Code installed (`npm install -g @anthropic-ai/claude-code`)
- An Apertis API Key (obtain from [Apertis Dashboard](https://apertis.ai/token))

## Manual Configuration

Claude Code supports custom API endpoints through environment variables. Configure the following three key variables to connect to Apertis API:

| Variable | Value |
|----------|-------|
| `ANTHROPIC_AUTH_TOKEN` | Your Apertis API key |
| `ANTHROPIC_BASE_URL` | `https://api.apertis.ai` |
| `API_TIMEOUT_MS` | `3000000` |

### Method 1: Settings File (Recommended)

Edit or create `~/.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your_apertis_api_key",
    "ANTHROPIC_BASE_URL": "https://api.apertis.ai",
    "API_TIMEOUT_MS": "3000000"
  }
}
```

Replace `your_apertis_api_key` with your actual API key from [Apertis Dashboard](https://apertis.ai/token).

### Method 2: Environment Variables

#### macOS / Linux

Set the environment variables directly in your shell:

```bash
export ANTHROPIC_BASE_URL="https://api.apertis.ai"
export ANTHROPIC_AUTH_TOKEN="your_apertis_api_key"
export API_TIMEOUT_MS="3000000"
```

To make these permanent, add them to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
# Add to ~/.zshrc or ~/.bashrc
export ANTHROPIC_BASE_URL="https://api.apertis.ai"
export ANTHROPIC_AUTH_TOKEN="your_apertis_api_key"
export API_TIMEOUT_MS="3000000"
```

Then reload your shell:
```bash
source ~/.zshrc  # or source ~/.bashrc
```

#### Windows Command Prompt

```cmd
setx ANTHROPIC_AUTH_TOKEN your_apertis_api_key
setx ANTHROPIC_BASE_URL https://api.apertis.ai
setx API_TIMEOUT_MS 3000000
```

#### Windows PowerShell

```powershell
[System.Environment]::SetEnvironmentVariable('ANTHROPIC_AUTH_TOKEN', 'your_apertis_api_key', 'User')
[System.Environment]::SetEnvironmentVariable('ANTHROPIC_BASE_URL', 'https://api.apertis.ai', 'User')
[System.Environment]::SetEnvironmentVariable('API_TIMEOUT_MS', '3000000', 'User')
```

After configuration, **open a new terminal window** and run `claude` to activate the settings.

## Launch Claude Code

Navigate to your project directory and start Claude Code:

```bash
cd your-project-directory
claude
```

Grant file access permissions when prompted.

## Model Configuration

You can customize which models Claude Code uses by adding model mappings:

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your_apertis_api_key",
    "ANTHROPIC_BASE_URL": "https://api.apertis.ai",
    "API_TIMEOUT_MS": "3000000",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-20250514",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-20250514",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-3-5-haiku-20241022"
  }
}
```

For the latest available models, check the [Model List](https://apertis.ai/models).

## Troubleshooting

### Configuration Not Taking Effect

- **Close all Claude Code windows** and open a new terminal
- Run `claude` again to restart with new settings
- Validate your JSON syntax using an online JSON validator

### Verify Configuration

Check your current version and configuration:
```bash
claude --version
```

### Connection Issues

If you encounter connection errors:

1. Verify your API key is correct at [Apertis Dashboard](https://apertis.ai/token)
2. Ensure the base URL is set to `https://api.apertis.ai`
3. Check your network connection and firewall settings

## Environment Variables Reference

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_AUTH_TOKEN` | Your Apertis API key |
| `ANTHROPIC_BASE_URL` | Custom API endpoint URL (`https://api.apertis.ai`) |
| `API_TIMEOUT_MS` | API request timeout in milliseconds (`3000000`) |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | Default model for opus tier |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | Default model for sonnet tier |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | Default model for haiku tier |
| `HTTP_PROXY` / `HTTPS_PROXY` | Network proxy (if required) |

## Features

Claude Code provides powerful capabilities including:

- **Code Understanding**: Analyzes your entire codebase context
- **Automated Refactoring**: Helps refactor and improve code quality
- **Git Workflow**: Manages commits, branches, and pull requests
- **Bug Fixing**: Identifies and helps fix issues in your code
- **Documentation**: Generates documentation and comments
- **Testing**: Helps write and run tests

## Related Resources

- [Apertis API Documentation](https://docs.apertis.ai)
- [Model List](https://apertis.ai/models)
- [API Keys Management](https://apertis.ai/token)
- [Claude Code Official Documentation](https://docs.anthropic.com/en/docs/claude-code/configuration)
