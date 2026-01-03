# Goose

Goose is an AI agent platform supporting local and desktop environments with CLI capabilities. It automates engineering tasks like code generation, debugging, testing, and deployment through MCP protocol integration.

## Features

- **Code Generation**: Generate code from natural language descriptions
- **Debugging**: Identify and fix issues in your code
- **Testing**: Create and run tests
- **Deployment**: Automate deployment workflows
- **MCP Protocol**: Enhanced functionality through MCP servers
- **Desktop App**: Native desktop application with GUI

## Installation

### Desktop Application

Download Goose Desktop from the [official website](https://block.github.io/goose/docs/quickstart/) and install for your operating system.

### CLI Installation

Follow the installation instructions from the official Goose documentation for CLI setup.

## Configuration for Apertis API

### Step 1: Open Provider Settings

1. Launch Goose Desktop
2. Click the menu on the left sidebar
3. Select **"Create New Provider"**

### Step 2: Configure Anthropic-Compatible Provider

Enter the following settings:

| Setting | Value |
|---------|-------|
| Provider Type | Anthropic Compatible |
| Base URL | `https://api.apertis.ai` |
| API Key | Your Apertis API key |

### Step 3: Select Model

Choose your preferred model:

| Model | Name |
|-------|------|
| Claude 3.5 Sonnet | `claude-3-5-sonnet-20241022` |
| Claude 3.5 Haiku | `claude-3-5-haiku-20241022` |
| Claude Sonnet 4 | `claude-sonnet-4-20250514` |
| Claude Opus 4 | `claude-opus-4-20250514` |

### Step 4: Activate Provider

1. Return to the main interface
2. Click **"Switch Models"** at the bottom
3. Select your newly configured Apertis provider from the dropdown

## Alternative: OpenAI-Compatible Configuration

You can also configure Goose with OpenAI-compatible settings:

| Setting | Value |
|---------|-------|
| Provider Type | OpenAI Compatible |
| Base URL | `https://api.apertis.ai/v1` |
| API Key | Your Apertis API key |

This allows access to all models including GPT and Gemini variants.

## Available Models

| Model | Name |
|-------|------|
| Claude 3.5 Sonnet | `claude-3-5-sonnet-20241022` |
| Claude 3.5 Haiku | `claude-3-5-haiku-20241022` |
| GPT-4o | `gpt-4o` |
| GPT-4o mini | `gpt-4o-mini` |
| Gemini 2.0 Flash | `gemini-2.0-flash-exp` |

## MCP Integration

Goose supports Model Context Protocol servers for enhanced functionality:

- **Vision Server**: Analyze images and visual content
- **Web Search Server**: Search the web for information
- **Web Reader Server**: Extract content from web pages

## Capabilities

Once configured, Goose can assist with:

- **Code Generation**: Create code based on requirements
- **Debugging**: Identify and fix bugs
- **Testing**: Generate and run test suites
- **Deployment**: Automate CI/CD workflows
- **Documentation**: Generate project documentation
- **Refactoring**: Improve code structure

## Troubleshooting

### Provider Not Working

- Verify your API key at [Apertis Dashboard](https://api.apertis.ai/token)
- Check the Base URL is correct for your provider type
- Try switching between Anthropic and OpenAI compatible modes

### Connection Issues

- Check your network connection
- Verify firewall settings allow connections
- Ensure the API key is valid and has sufficient quota

## Related Resources

- [Model List](https://api.apertis.ai/)
- [API Keys Management](https://api.apertis.ai/token)
- [Claude Code](/installation/claude-code) - Terminal-based AI coding tool
- [Goose Official Documentation](https://block.github.io/goose/docs/quickstart/)
