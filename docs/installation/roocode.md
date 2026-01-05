# Roo Code

Roo Code is an intelligent VS Code extension that assists with project analysis, code generation, and refactoring. It provides a seamless way to integrate AI-powered development capabilities directly into your IDE.

## Features

- **Project Analysis**: Summarizes project structure and analyzes modules
- **Code Generation**: Creates code based on natural language descriptions
- **Refactoring**: Suggests and implements code improvements
- **Documentation**: Generates documentation for your codebase
- **Issue Diagnosis**: Identifies problems and suggests fixes

## Installation

### Step 1: Install Extension

1. Launch VS Code
2. Click the Extensions icon on the left sidebar
3. Search for "Roo Code"
4. Click **Install**
5. Select "Trust the Author" when prompted

### Step 2: Open Settings

Navigate to Roo Code settings:
- Click the Roo Code icon in the sidebar
- Select **Settings** → **API Providers**

![image](../static/img/roocode_1.png)

## Configure Apertis API

### API Provider Setup

1. Select **OpenAI Compatible** as the API mode
2. Enter the Base URL: `https://api.apertis.ai/v1`
3. Enter your API Key (obtain from [Apertis Dashboard](https://apertis.ai/token))
4. Enter the model name from the [Model List](https://apertis.ai/models)

![image](../static/img/roocode_2.png)

### Available Models

| Model | Name to Enter |
|-------|---------------|
| Claude 3.5 Sonnet | `claude-3-5-sonnet-20241022` |
| Claude 3.5 Haiku | `claude-3-5-haiku-20241022` |
| GPT-4o | `gpt-4o` |
| GPT-4o mini | `gpt-4o-mini` |
| Gemini 2.0 Flash | `gemini-2.0-flash-exp` |

## Permissions Setup

Roo Code allows you to configure three permission categories:

- **File Operations**: Read and write access to project files
- **Auto-approve**: Automatically approve certain actions
- **Project Access**: Control which projects Roo Code can access

## Capabilities

Once configured, Roo Code can assist with:

- **Project Structure**: Summarize and understand your codebase
- **Module Analysis**: Analyze functionality and dependencies
- **Code Refactoring**: Optimize and improve code quality
- **Documentation**: Generate docs for functions and modules
- **Issue Diagnosis**: Identify bugs and suggest fixes

## Troubleshooting

### Connection Issues

- Verify your API key at [Apertis Dashboard](https://apertis.ai/token)
- Ensure the Base URL is `https://api.apertis.ai/v1`
- Check that the model name matches the [Model List](https://apertis.ai/models) exactly

### Extension Not Working

- Restart VS Code after configuration changes
- Check the Output panel for error messages
- Ensure you have trusted the extension author

## Related Resources

- [Model List](https://apertis.ai/models)
- [API Keys Management](https://apertis.ai/token)
- [Cline Extension](/installation/cline) - Alternative VS Code AI assistant
