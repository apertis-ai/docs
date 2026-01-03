# Kilo Code

Kilo Code is a VS Code extension enhanced by MCP (Model Context Protocol) support, enabling direct code generation, debugging, and project management within the editor.

## Features

- **Code Generation**: Generate code from natural language descriptions
- **Database Analysis**: Analyze database structures and relationships
- **SQL Optimization**: Generate and optimize SQL queries
- **Project Management**: Manage and organize project files
- **Refactoring**: Improve code quality and structure
- **Documentation**: Create documentation for your codebase

## Installation

### Step 1: Install Extension

1. Launch VS Code
2. Open the Extensions Marketplace (left sidebar)
3. Search for "Kilo Code"
4. Click **Install**
5. Trust the developer when prompted

### Step 2: Configure API Key

After installation, select **"Use your own API key"** option to configure custom API settings.

## Configure Apertis API

### API Provider Setup

1. Open Kilo Code settings
2. Select **OpenAI Compatible** as the API Provider
3. Enter the Base URL: `https://api.apertis.ai/v1`
4. Enter your API Key (obtain from [Apertis Dashboard](https://api.apertis.ai/token))
5. Select a model from the [Model List](https://api.apertis.ai/)

### Configuration Summary

| Setting | Value |
|---------|-------|
| API Provider | OpenAI Compatible |
| Base URL | `https://api.apertis.ai/v1` |
| API Key | Your Apertis API key |
| Model | See model list below |

### Available Models

| Model | Name to Enter |
|-------|---------------|
| Claude 3.5 Sonnet | `claude-3-5-sonnet-20241022` |
| Claude 3.5 Haiku | `claude-3-5-haiku-20241022` |
| GPT-4o | `gpt-4o` |
| GPT-4o mini | `gpt-4o-mini` |
| Gemini 2.0 Flash | `gemini-2.0-flash-exp` |

## Capabilities

Once configured, Kilo Code can assist with:

- **Database Structure Analysis**: Understand and document database schemas
- **Statistical Calculations**: Perform data analysis and calculations
- **SQL Query Generation**: Create optimized SQL queries
- **Code Generation**: Generate code based on requirements
- **Project Analysis**: Analyze and document project structure
- **Refactoring**: Suggest and implement code improvements

## MCP Integration

Kilo Code supports MCP (Model Context Protocol) for enhanced functionality:

- **Vision Server**: Analyze images and visual content
- **Web Search Server**: Search the web for information
- **Web Reader Server**: Extract content from web pages

## Troubleshooting

### Connection Issues

- Verify your API key at [Apertis Dashboard](https://api.apertis.ai/token)
- Ensure the Base URL is `https://api.apertis.ai/v1`
- Check that the model name matches the [Model List](https://api.apertis.ai/) exactly

### Extension Not Working

- Restart VS Code after configuration changes
- Check the Output panel for error messages
- Ensure you selected "Use your own API key" option

## Related Resources

- [Model List](https://api.apertis.ai/)
- [API Keys Management](https://api.apertis.ai/token)
- [Roo Code Extension](/installation/roocode) - Alternative VS Code AI assistant
- [Cline Extension](/installation/cline) - Another VS Code AI coding tool
