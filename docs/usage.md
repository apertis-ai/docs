---
sidebar_position: 3
---

# 各模型使用場景

目前市面上之主要大型語言模型供應商包含有 **[OpenAI](https://openai.com/)**, **[Anthropic](https://www.anthropic.com/)**, **[Google](https://gemini.google.com/)**, **[Meta](https://www.llama.com/)**, **[Microsoft](https://www.microsoft.com/en-us/ai/microsoft-365-copilot)**, **[Mistral](https://mistral.ai/)** 以及 **[Alibaba](https://www.alibabacloud.com/)**，其各自提供不同領域優勢的人工智慧解決方案，滿足各種應用需求。

### 推薦模型
* 【**知識查詢、文章生成、日常需求**】: **OpenAI GPT-4o**，模型代號 `gpt-4o`。
* 【**程式開發**】 : **Anthropic Claude 3.5 Sonnet**，模型代號 `claude-3-5-sonnet-20241022`, `claude-3-5-sonnet-20240620`。
* 【**翻譯需求 (網頁內容、字幕、論文)**】 : **Google Gemini 1.5 Flash**，模型代號 `gpt-4o-mini`, `gemini-1.5-flash-latest`。

<!-- ### 模型命名規則:
**模型名稱-子版本**，如`claude-3-5-sonnet-20240620`、`gpt-4-turbo-2024-04-09`、`gemini-1.5-flash-latest`、`gpt-4o-mini-2024-07-18`... -->

### 模型命名規則

export const CenteredContainer = ({children}) => (
  <div style={{textAlign: 'center', margin: '1em 0'}}>
    {children}
  </div>
);

export const LargeText = ({children}) => (
  <span style={{fontSize: '1.25em'}}>
    {children}
  </span>
);

export const RedText = ({children}) => (
  <span style={{color: 'red'}}>
    {children}
  </span>
);

<!-- <CenteredContainer>
  <LargeText>
    Claude(<RedText>模型名稱</RedText>)-3.5(<RedText>版本號</RedText>)-Sonnet(<RedText>特定子版本</RedText>)-20240620(<RedText>發布日期</RedText>)
  </LargeText>
</CenteredContainer> -->


* **模型名稱:** 模型名稱直接對應其開發公司或發行商，例如 `GPT*`, `o1-preview`, `o1-mini` (**OpenAI**)、`Claude` (**Anthropic**)、`Gemini` (**Google**)、`Llama*` (**Meta**) 等等。
* **版本號:** 通常版本號較大的模型相比於版本號較小的模型在能力上有**顯著**的提升，擁有更強的推理能力，例如 `gpt-4o` 相比於 `gpt-4-turbo` 在能力上有顯著的提升。
* **子版本:** 不同子版本之間存在性能差異，但不如主版本之間的差異之大。子版本的命名多變，例如 `gpt-4o`、`gpt-4` 等。以 **Gemini** 為例，**mini, flash** 通常代表模型參數較少，價格也較便宜。當模型名稱包含 **32k, 128k, 4096**，代表該模型接受之最大上下文長度。


### **OpenAI**
**應用場域**：OpenAI 的模型廣泛應用於**聊天機器人、內容生成、日常助理**等多個領域。
**OpenAI 推薦的模型** 為 `o1-preview`, `o1-mini`, `gpt-4o`, `gpt-4o-mini`。

### **Anthropic**
**應用場域**：**Claude** 是目前最強的**程式開發助理**，其能透過 Retrieval Augmented Generation (RAG) 理解您的程式並提供協助。搭配 Cursor 進行 Codebase 的 RAG，將能通過分析整段程式以解決問題，並提供開發提示，進而提升開發效率。
**Claude 推薦的模型**為 `claude-opus-4-5-20251101`, `claude-sonnet-4-20250514`, `claude-3-5-sonnet-20241022`。

### **Google**
**應用場域**：Gemini 的模型能力較為通用，其最大的特點為以較低的價格提供優質的服務。其應用場域包含**翻譯網頁內容、大量 PDF（如論文、專利）**。
**Gemini 推薦的模型** 為 `gemini-1.5-flash-latest`, `gemini-1.5-flash-002`。
