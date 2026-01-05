# Cursor IDE

Cursor IDE is an AI-powered code editor built as an enhanced fork of Visual Studio Code. It integrates deeply with your development workflow, understanding your project structure, coding style, and team best practices.

## Requirements

- Cursor IDE (Pro or higher recommended for custom model configuration)
- An Apertis API Key (obtain from [Apertis Dashboard](https://apertis.ai/token))

## Installation

### Download

Visit the **[Cursor IDE Official Website](https://www.cursor.com/)** and click the download button in the top right corner.

![image](https://hackmd.io/_uploads/SJH2WxDoC.jpg)

### Setup

Double-click the installer to start the setup process:

![image](https://hackmd.io/_uploads/SkH32oP50.png)

- **Language for AI**: Choose the language for AI responses. For Traditional Chinese, enter `Traditional Chinese`.
- **Codebase-wide**: Enable embedding and RAG for your entire codebase. This allows vector search for better AI-assisted coding.
- **Add to Command Line**: Click `install cursor` to enable command-line access.

### Import VSCode Extensions

If you previously used VSCode with extensions (Jupyter Notebook, Prettier, etc.), you can import them directly to Cursor IDE by clicking the **Use Extensions** button.

![image](https://hackmd.io/_uploads/HJOOAswq0.png)

If you had the `Continue` extension installed, you'll be asked whether to continue using it or switch to Cursor's built-in AI. We recommend using Cursor's AI for the best experience.

![image](https://hackmd.io/_uploads/rJHfJhDcC.png)

## Configure Apertis API

### Step 1: Open Settings

Navigate to **Settings** → **Models** in Cursor IDE.

![image](https://hackmd.io/_uploads/BkDbZNqcC.png)

### Step 2: Configure API

1. Scroll to the **OpenAI API Key** section
2. Enter your Apertis API Key
3. Enable **Override OpenAI Base URL**
4. Enter the base URL: `https://api.apertis.ai/v1`
5. Click the **Verify** button to confirm the connection

![image](https://hackmd.io/_uploads/SJVqOgviA.png)

### Step 3: Add Models

Click **Add model** and enter the model name. The model name must match the [Model List](https://apertis.ai/models) exactly.

Available models include:

| Model | Name to Enter |
|-------|---------------|
| Claude 3.5 Sonnet | `claude-3-5-sonnet-20241022` |
| Claude 3.5 Haiku | `claude-3-5-haiku-20241022` |
| GPT-4o | `gpt-4o` |
| GPT-4o mini | `gpt-4o-mini` |
| Gemini 1.5 Pro | `gemini-1.5-pro-latest` |
| Gemini 2.0 Flash | `gemini-2.0-flash-exp` |

![image](https://hackmd.io/_uploads/H1g9N9Po0.png)

### Step 4: Select Model

Go to the chat interface and select your newly added model from the dropdown.

![image](https://hackmd.io/_uploads/rJtJr9DsR.png)

## Troubleshooting

### Model Not Working

- Ensure the model name matches exactly with the [Model List](https://apertis.ai/models)
- Verify your API key is valid and has sufficient quota
- Check that the base URL is set to `https://api.apertis.ai/v1`

### Connection Errors

- Check your network connection
- Verify the API key in your [Apertis Dashboard](https://apertis.ai/token)
- Ensure the base URL is correctly entered with no trailing slash

## Related Resources

- [Model List](https://apertis.ai/models)
- [API Keys Management](https://apertis.ai/token)
- [Claude Code Integration](/installation/claude-code) - For terminal-based AI coding
