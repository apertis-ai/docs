# Continue Dev

[**Continue Dev**](https://www.continue.dev/) 是一款為 **VSCode**, **Cursor IDE** 開發的擴充套件，功能在於簡化用戶與 ChatGPT 等大型語言模型的互動過程。允許使用者輕鬆將程式碼片段導入大型語言模型，以利用大型語言模型進行輔助開發。

### 介紹

與 **Cursor IDE** 相比，兩者皆展現出以 **程式為本的語言模型交互能力**，並提供 **自動改寫功能**。然而，Cursor 因其更加注重 Codebase RAG（檢索增強生成）並於自動完成（Autocomplete）的精確度上大幅領先。

然而，Continue 在快速查詢大型語言模型和除錯方面仍然表現出色。作為一款輕量級的擴充軟件，Continue Dev 提供了另一種使用選擇。無論需要即時解答、尋求程式優化建議，抑或是當 Cursor IDE 發生故障時，Continue Dev 都能提供不錯的協助。

### 安裝

本文主要針對 VSCode 安裝進行教學。首先，於左側選單找到【擴充軟體】的圖示，並搜尋**Continue**。

![](https://hackmd.io/_uploads/HJ_E-najC.jpg)

安裝完後將出現以下畫面，但目前左邊的對話框尚未有功能，因需要額外設定 `config.json`。

![](https://hackmd.io/_uploads/SyRkfh6j0.jpg)

### 添加 `config.json`

找到左下方的齒輪圖案，點擊後將會跳轉至`config.json`檔案。

![](https://hackmd.io/_uploads/HkxMqpYM3A.png)

複製下方`json`檔並貼入`config.json`中。**apiKey** 數值必需換成您的 **API Key**。

```json
{
"models": [
  {
    "model": "claude-3-5-sonnet-20240620",
    "apiBase": "https://api.apertis.ai/v1",
    "title": "Claude 3.5",
    "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
    "provider": "openai",
    "description": "Explain in Traditional Chinese"
  },
  {
    "model": "gpt-4o",
    "apiBase": "https://api.apertis.ai/v1",
    "title": "GPT-4o",
    "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
    "provider": "openai",
    "description": "Explain in Traditional Chinese"
  },
  {
    "model": "gpt-4-turbo",
    "apiBase": "https://api.apertis.ai/v1",
    "title": "GPT-4-Turbo",
    "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
    "provider": "openai",
    "description": "Explain in Traditional Chinese"
  },
  {
    "model": "gpt-3.5-turbo",
    "apiBase": "https://api.apertis.ai/v1",
    "title": "GPT-3.5-Turbo",
    "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
    "provider": "openai",
    "description": "Explain in Traditional Chinese"
  },
  {
    "model": "gemini-1.5-pro-latest",
    "apiBase": "https://api.apertis.ai/v1",
    "title": "gemini-1.5-pro-latest",
    "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
    "provider": "openai",
    "description": "Explain in Traditional Chinese"
  },
  {
    "model": "gemini-1.5-flash-latest",
    "apiBase": "https://api.apertis.ai/v1",
    "title": "gemini-1.5-flash-latest",
    "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
    "provider": "openai",
    "description": "Explain in Traditional Chinese"
  }

],
"customCommands": [
  {
    "name": "test",
    "prompt": "{{{ input }}}\n\nWrite a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
    "description": "Write unit tests for highlighted code"
  }
],
"allowAnonymousTelemetry": true,
"embeddingsProvider": {
  "provider": "free-trial"
},
"tabAutocompleteModel": {
    "model": "gpt-4o",
    "apiBase": "https://api.apertis.ai/v1",
    "title": "GPT-4o",
    "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
    "provider": "openai"
  },
"tabAutocompleteOptions": {
    "useCopyBuffer": false,
    "maxPromptTokens": 400,
    "prefixPercentage": 0.5
  },
"reranker": {
  "name": "free-trial"
}
}

```

### 開始使用

**詢問程式問題**

- 選取一段程式碼後【Ctrl + L】

![](https://hackmd.io/_uploads/r1zYS2TiR.png)

**改寫程式**

- 選取一段程式碼後【Ctrl + I】

![](https://hackmd.io/_uploads/HJozI3aoR.png)