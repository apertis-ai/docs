---
sidebar_position: 2
---

# Models Intro 

Leading large language model providers on the market include **[OpenAI](https://openai.com/)**, **[Anthropic](https://www.anthropic.com/)**, **[Google](https://gemini.google.com/)**, **[Meta](https://www.llama.com/)**, **[Microsoft](https://www.microsoft.com/en-us/ai/microsoft-365-copilot)**, **[Mistral](https://mistral.ai/)**, and **[Alibaba](https://www.alibabacloud.com/)**. Each offers AI solutions with unique strengths tailored to various application needs.

### Recommended Models
- **Knowledge Queries, Content Generation, Daily Assistance**: **OpenAI GPT-4o**, Model ID: `gpt-4o`.
- **Programming and Development**: **Anthropic Claude 3.5 Sonnet**, Model IDs: `claude-3-5-haiku-20241022`, `claude-3-5-sonnet-20241022`, `claude-3-5-sonnet-20240620`.
- **Translation (Web Content, Subtitles, Research Papers)**: **Google Gemini 1.5 Flash**, Model IDs: `gpt-4o-mini`, `gemini-1.5-flash-latest`.

### Model Naming Rules

Models are typically named with the following structure:

- **Model Name**: Corresponds to the developer or provider, such as `GPT*`, `o1-preview`, `o1-mini` (**OpenAI**), `Claude` (**Anthropic**), `Gemini` (**Google**), `Llama*` (**Meta**), etc.
- **Version Number**: Larger version numbers indicate significant improvements in capabilities, such as enhanced reasoning abilities. For instance, `gpt-4o` is more capable than `gpt-4-turbo`.
- **Sub-Version**: Sub-versions exhibit minor performance differences compared to main versions. Naming conventions vary, e.g., `gpt-4o`, `gpt-4`. For **Gemini**, terms like **mini, flash** denote fewer parameters and lower costs. Context lengths like **32k, 128k, 4096** indicate the maximum token length the model supports.

### **OpenAI**
- **Use Cases**: OpenAI models are widely used in **chatbots, content generation, and personal assistants**.
- **Recommended Models**: `o1-preview`, `o1-mini`, `gpt-4o`, `gpt-4o-mini`.

### **Anthropic**
- **Use Cases**: **Claude** excels as a **programming assistant**, leveraging Retrieval Augmented Generation (RAG) to understand codebases and provide solutions. Paired with tools like Cursor for RAG analysis, it can efficiently analyze entire codebases, solve issues, and improve development workflows.
- **Recommended Models**: `claude-3-5-sonnet-20240620`, `claude-3-5-sonnet-20241022`.

### **Google**
- **Use Cases**: Gemini models offer general-purpose capabilities with competitive pricing. They are ideal for **translating web content and processing large PDFs** (e.g., research papers, patents).
- **Recommended Models**: `gemini-1.5-flash-latest`, `gemini-1.5-flash-002`.