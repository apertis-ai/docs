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

### Step 1: Authentication Setup

Run the authentication command:

```bash
opencode auth login
```

### Step 2: Configure Custom Provider

When prompted, select custom API configuration and enter:

| Setting | Value |
|---------|-------|
| Base URL | `https://api.apertis.ai/v1` |
| API Key | Your Apertis API key |

Alternatively, set environment variables:

```bash
export OPENAI_API_BASE="https://api.apertis.ai/v1"
export OPENAI_API_KEY="your_apertis_api_key"
```

Add to your shell profile (`~/.zshrc` or `~/.bashrc`) for persistence:

```bash
# Add to ~/.zshrc or ~/.bashrc
export OPENAI_API_BASE="https://api.apertis.ai/v1"
export OPENAI_API_KEY="your_apertis_api_key"
```

### Step 3: Launch OpenCode

```bash
opencode
```

### Step 4: Select Model

Use the `/models` command within OpenCode to select your preferred model.

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

- Verify your API key at [Apertis Dashboard](https://api.apertis.ai/token)
- Ensure the Base URL is set correctly
- Check environment variables are exported

### Authentication Problems

Reset authentication and reconfigure:

```bash
opencode auth logout
opencode auth login
```

## Related Resources

- [Model List](https://api.apertis.ai/)
- [API Keys Management](https://api.apertis.ai/token)
- [Claude Code](/installation/claude-code) - Alternative terminal AI coding tool
- [OpenCode Documentation](https://opencode.ai/docs)
