---
sidebar_position: 2
---

# Models Intro 

Leading large language model providers on the market include **[OpenAI](https://openai.com/)**, **[Anthropic](https://www.anthropic.com/)**, **[Google](https://gemini.google.com/)**, **[Meta](https://www.llama.com/)**, **[Microsoft](https://www.microsoft.com/en-us/ai/microsoft-365-copilot)**, **[Mistral](https://mistral.ai/)**, and **[Alibaba](https://www.alibabacloud.com/)**. Each offers AI solutions with unique strengths tailored to various application needs.

### Recommended Models
- **Knowledge Queries, Content Generation, Daily Assistance**: **OpenAI GPT-5.2**, Model ID: `gpt-5.2`.
- **Programming and Development**: **Anthropic Claude Sonnet 4.5**, Model IDs: `claude-haiku-4.5`, `claude-sonnet-4.5`.
- **Translation (Web Content, Subtitles, Research Papers)**: **Google Gemini 3 Flash**, Model IDs: `gpt-4.1-mini`, `gemini-3-flash-preview`.

### Model Naming Rules

Models are typically named with the following structure:

- **Model Name**: Corresponds to the developer or provider, such as `GPT*`, `o4-mini` (**OpenAI**), `Claude` (**Anthropic**), `Gemini` (**Google**), `Llama*` (**Meta**), etc.
- **Version Number**: Larger version numbers indicate significant improvements in capabilities, such as enhanced reasoning abilities. For instance, `gpt-5.2` is more capable than `gpt-4.1`.
- **Sub-Version**: Sub-versions exhibit minor performance differences compared to main versions. Naming conventions vary, e.g., `gpt-5.2`, `gpt-4.1`. For **Gemini**, terms like **mini, flash** denote fewer parameters and lower costs. Context lengths like **32k, 128k, 4096** indicate the maximum token length the model supports.

### **OpenAI**
- **Use Cases**: OpenAI models are widely used in **chatbots, content generation, and personal assistants**.
- **Recommended Models**: `o4-mini`, `gpt-5.2`, `gpt-4.1-mini`.

### **Anthropic**
- **Use Cases**: **Claude** excels as a **programming assistant**, leveraging Retrieval Augmented Generation (RAG) to understand codebases and provide solutions. Paired with tools like Cursor for RAG analysis, it can efficiently analyze entire codebases, solve issues, and improve development workflows.
- **Recommended Models**: `claude-sonnet-4.5`, `claude-haiku-4.5`.

### **Google**
- **Use Cases**: Gemini models offer general-purpose capabilities with competitive pricing. They are ideal for **translating web content and processing large PDFs** (e.g., research papers, patents).
- **Recommended Models**: `gemini-3-flash-preview`, `gemini-3-pro-preview`.