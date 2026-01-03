# Cline

Cline (previously Claude Dev) is a powerful VS Code extension that lets you use AI models directly in your editor for code generation, file operations, and more.

## Features

- **Code Generation**: Generate code from natural language descriptions
- **File Operations**: Create, edit, and manage files
- **Code Refactoring**: Improve and optimize existing code
- **Logic Explanation**: Understand complex code logic
- **Debugging**: Identify and fix issues in your code

## Installation

### Step 1: Install Extension

1. Open VS Code
2. Click the Extensions icon on the left sidebar
3. Search for "Cline"
4. Select [**Cline (prev. Claude Dev)**](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev)
5. Click **Install** and trust the developer when prompted

### Step 2: Open Settings

Click the Cline icon in the sidebar, then select the settings button in the top right corner.

## Configure Apertis API

### API Provider Setup

1. Select **"Use your own API Key"** option
2. Configure the following settings:

| Setting | Value |
|---------|-------|
| API Provider | OpenAI Compatible |
| Base URL | `https://api.apertis.ai/v1` |
| API Key | Your Apertis API key |
| Model | Select from model list below |

![image](https://raw.githubusercontent.com/Stima-Tech/documentation/refs/heads/main/static/img/cline.png)

### Available Models

| Model | Name to Enter |
|-------|---------------|
| Claude 3.5 Sonnet | `claude-3-5-sonnet-20241022` |
| Claude 3.5 Haiku | `claude-3-5-haiku-20241022` |
| GPT-4o | `gpt-4o` |
| GPT-4o mini | `gpt-4o-mini` |
| Gemini 2.0 Flash | `gemini-2.0-flash-exp` |

### Optional Settings

You can adjust additional parameters based on your needs:

- **Temperature**: Controls randomness (0.0 - 1.0)
- **Context Window**: Maximum tokens for context

## Capabilities

Once configured, Cline can assist with:

- **File Creation**: Create new files and directories
- **Code Editing**: Modify existing code files
- **Code Generation**: Generate code from descriptions
- **Refactoring**: Improve code structure and quality
- **Debugging**: Identify and explain bugs
- **Logic Explanation**: Understand complex algorithms

## MCP Integration

Cline supports Model Context Protocol (MCP) servers for enhanced functionality:

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
- Ensure you selected "OpenAI Compatible" as the provider

## Related Resources

- [Model List](https://api.apertis.ai/)
- [API Keys Management](https://api.apertis.ai/token)
- [Roo Code Extension](/installation/roocode) - Alternative VS Code AI assistant
- [Kilo Code Extension](/installation/kilo-code) - Another VS Code AI coding tool
