# Claude Code

Claude Code is an agentic terminal tool that understands codebases and accelerates development by automating routine tasks, analyzing complex code, and managing git workflows through natural language commands.

## Prerequisites

- Node.js 18 or newer installed on your system (for npm installation)
- An Apertis API Key (obtain from [Apertis Dashboard](https://apertis.ai/token))

## Installation

### Native Installer (Recommended)

**macOS / Linux / WSL:**

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows PowerShell:**

```powershell
irm https://claude.ai/install.ps1 | iex
```

### npm Installation

Alternatively, install via npm with Node.js 18+:

```bash
npm install -g @anthropic-ai/claude-code
```

## Configuration

Claude Code supports custom API endpoints through environment variables. Configure the following variables to connect to Apertis API:

| Variable | Value | Description |
|----------|-------|-------------|
| `ANTHROPIC_BASE_URL` | `https://api.apertis.ai` | Apertis API endpoint |
| `ANTHROPIC_AUTH_TOKEN` | Your Apertis API key | Authentication token |
| `ANTHROPIC_API_KEY` | `""` (empty string) | **Must be explicitly empty** |
| `API_TIMEOUT_MS` | `3000000` | Request timeout (optional) |

:::warning Important
The `ANTHROPIC_API_KEY` must be explicitly set to an empty string, not just unset. This prevents conflicts with any existing Anthropic configuration.
:::

### Method 1: Settings File (Recommended)

Edit or create `~/.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.apertis.ai",
    "ANTHROPIC_AUTH_TOKEN": "your_apertis_api_key",
    "ANTHROPIC_API_KEY": "",
    "API_TIMEOUT_MS": "3000000"
  }
}
```

Replace `your_apertis_api_key` with your actual API key from [Apertis Dashboard](https://apertis.ai/token).

### Method 2: Project-Level Configuration

For project-specific settings, create `.claude/settings.local.json` in your project root:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.apertis.ai",
    "ANTHROPIC_AUTH_TOKEN": "your_apertis_api_key",
    "ANTHROPIC_API_KEY": ""
  }
}
```

:::note
Do not use standard `.env` files; the native installer doesn't read them. Use the settings files or shell environment variables instead.
:::

### Method 3: Environment Variables

#### macOS / Linux

Add to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
export ANTHROPIC_BASE_URL="https://api.apertis.ai"
export ANTHROPIC_AUTH_TOKEN="your_apertis_api_key"
export ANTHROPIC_API_KEY=""
export API_TIMEOUT_MS="3000000"
```

Then reload your shell:

```bash
source ~/.zshrc  # or source ~/.bashrc
```

To remove the configuration and revert to defaults:

```bash
unset ANTHROPIC_BASE_URL
unset ANTHROPIC_AUTH_TOKEN
unset ANTHROPIC_API_KEY
unset API_TIMEOUT_MS
```

Also remove the corresponding lines from your shell profile file, then reload your shell.

#### Windows Command Prompt

```cmd
setx ANTHROPIC_BASE_URL https://api.apertis.ai
setx ANTHROPIC_AUTH_TOKEN your_apertis_api_key
setx ANTHROPIC_API_KEY ""
setx API_TIMEOUT_MS 3000000
```

To remove the configuration:

```cmd
reg delete "HKCU\Environment" /v ANTHROPIC_BASE_URL /f
reg delete "HKCU\Environment" /v ANTHROPIC_AUTH_TOKEN /f
reg delete "HKCU\Environment" /v ANTHROPIC_API_KEY /f
reg delete "HKCU\Environment" /v API_TIMEOUT_MS /f
```

#### Windows PowerShell

```powershell
[System.Environment]::SetEnvironmentVariable('ANTHROPIC_BASE_URL', 'https://api.apertis.ai', 'User')
[System.Environment]::SetEnvironmentVariable('ANTHROPIC_AUTH_TOKEN', 'your_apertis_api_key', 'User')
[System.Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', '', 'User')
[System.Environment]::SetEnvironmentVariable('API_TIMEOUT_MS', '3000000', 'User')
```

To remove the configuration:

```powershell
[System.Environment]::SetEnvironmentVariable('ANTHROPIC_BASE_URL', $null, 'User')
[System.Environment]::SetEnvironmentVariable('ANTHROPIC_AUTH_TOKEN', $null, 'User')
[System.Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', $null, 'User')
[System.Environment]::SetEnvironmentVariable('API_TIMEOUT_MS', $null, 'User')
```

After configuration, **open a new terminal window** and run `claude` to activate the settings.

## Launch and Verify

Navigate to your project directory and start Claude Code:

```bash
cd your-project-directory
claude
```

Grant file access permissions when prompted.

### Verify Connection

Run the status command inside Claude Code to verify your configuration:

```
/status
```

You should see output similar to:

```
Auth token: ANTHROPIC_AUTH_TOKEN
Anthropic base URL: https://api.apertis.ai
```

## Model Configuration

### Setting a Default Model

You can set a default model using the `ANTHROPIC_MODEL` environment variable:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.apertis.ai",
    "ANTHROPIC_AUTH_TOKEN": "your_apertis_api_key",
    "ANTHROPIC_API_KEY": "",
    "ANTHROPIC_MODEL": "claude-opus-4-5-20251101"
  }
}
```

:::info Subscription Plan Users
If you are using a **subscription plan**, add the `code:` prefix to the model ID:

```json
{
  "env": {
    "ANTHROPIC_MODEL": "code:claude-opus-4-5-20251101"
  }
}
```
:::

### Selecting Models in Claude Code

After configuration, you can view and select your custom model inside Claude Code:

1. Launch Claude Code in your terminal:
   ```bash
   claude
   ```

2. Use the `/model` command to see available models:
   ```
   /model
   ```

3. Your custom model ID will appear in the list. Select it to start using the configured model.

### Model Tier Mappings

You can also customize which models are used for each tier (opus, sonnet, haiku):

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.apertis.ai",
    "ANTHROPIC_AUTH_TOKEN": "your_apertis_api_key",
    "ANTHROPIC_API_KEY": "",
    "API_TIMEOUT_MS": "3000000",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-20250514",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-20250514",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-3-5-haiku-20241022"
  }
}
```

:::tip Tool Use Requirement
The selected models must support **tool use** capabilities. Claude Code requires tool use for file operations, terminal commands, and code editing. All Claude models available through Apertis support tool use.
:::

For the latest available models, check the [Model List](https://apertis.ai/models).

## GitHub Actions Integration

You can use Claude Code in your CI/CD pipelines with GitHub Actions:

```yaml
- name: Run Claude Code
  uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.APERTIS_API_KEY }}
  env:
    ANTHROPIC_BASE_URL: https://api.apertis.ai
    ANTHROPIC_API_KEY: ""
```

Store your Apertis API key as a GitHub secret named `APERTIS_API_KEY`.

## Troubleshooting

### Configuration Not Taking Effect

- **Close all Claude Code windows** and open a new terminal
- Run `claude` again to restart with new settings
- Validate your JSON syntax using an online JSON validator

### Verify Configuration

Check your current version:

```bash
claude --version
```

Inside Claude Code, run `/status` to verify the API endpoint configuration.

### Connection Issues

If you encounter connection errors:

1. Verify your API key is correct at [Apertis Dashboard](https://apertis.ai/token)
2. Ensure the base URL is set to `https://api.apertis.ai`
3. **Confirm `ANTHROPIC_API_KEY` is explicitly set to empty**, not just unset
4. Check your network connection and firewall settings

### Tool Use Failures

If Claude Code fails to execute file operations or commands:

- Ensure your selected model supports tool use capabilities
- Use the default Claude models which all support tool use
- Check that you have granted the necessary file access permissions

### Context Limitations

For complex tasks with large codebases:

- Use models with 128k+ context windows
- Consider breaking large operations into smaller tasks

## Environment Variables Reference

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_BASE_URL` | Custom API endpoint URL (`https://api.apertis.ai`) |
| `ANTHROPIC_AUTH_TOKEN` | Your Apertis API key |
| `ANTHROPIC_API_KEY` | Must be explicitly empty (`""`) |
| `ANTHROPIC_MODEL` | Default model ID (use `code:` prefix for subscription plans) |
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
