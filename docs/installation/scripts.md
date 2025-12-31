# 透過 OpenAI SDK 呼叫 Stima API

### Python

Stima API 為 **OpenAI Compatible APIs**，故使用 `Python` 中的 `openai` SDK，並修改 `model` 以及 `base_url` 變數即可呼叫所有 Stima AI 提供之模型。

```python
key = "<STIMA_API_KEY>" # 請換成您的 API Key
from openai import OpenAI

client = OpenAI(
    api_key=key,
    base_url="https://api.apertis.ai/v1/"
)

chat_completion = client.chat.completions.create(
    model="<MODEL_ALIAS>", # 請修改 model 變數以呼叫不同模型
    messages=[
        {"role": "user", "content": "Hello world"}
    ]
)

print(chat_completion.choices[0].message.content)

```

### JavaScript

```javascript
const apiKey = '<STIMA_API_KEY>';
const apiUrl = 'https://api.apertis.ai/v1/chat/completions';

async function callOpenAI(prompt) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: '<MODEL_ALIAS>',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.7
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

callOpenAI('Hello world').then(reply => console.log(reply));

```

### TypeScript

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: '<STIMA_API_KEY>', // 請確保在環境變數中設定了您的 Stima API 金鑰
  baseURL: 'https://api.apertis.ai/v1', // 替換為 Stima API 端點
});


async function getChatCompletion(prompt: string): Promise<void> {
  try {
    const chatCompletion = await openai.chat.completions.create({
      model: '<MODEL_ALIAS>', // 或其他您想使用的模型
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.7,
    });

    console.log(chatCompletion.choices[0].message.content);
  } catch (error) {
    console.error('Error fetching chat completion:', error);
  }
}

// 使用範例
getChatCompletion('Hello world');
```


### cURL

使用 `cURL` 呼叫 Stima API，僅需修改 `api_key` 和 `model` 變數即可呼叫所有支援模型。  
請將 `<STIMA_API_KEY>`, `model`數值修改成您的 **API Key** 及 **模型別名**。

```bash
curl https://api.apertis.ai/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <STIMA_API_KEY>" \
    -d '{
        "model": "<MODEL_ALIAS>",
        "messages": [
            {
                "role": "system",
                "content": "You are a test assistant."
            }
        ]
    }'

```
