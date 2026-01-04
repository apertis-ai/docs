# Call Stima API via OpenAI SDK

### Python

Stima API provides **OpenAI Compatible APIs**, so you can use the `OpenAI` package in `Python` and modify the `model` variable to call all supported models.

```python
key = '<STIMA_API_KEY>' # Please replace with your API Key
from openai import OpenAI

client = OpenAI(
    api_key=key,
    base_url="https://api.apertis.ai/v1/"
)

chat_completion = client.chat.completions.create(
    model="<MODEL_ALIAS>", # Modify the model variable to call different models
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
  apiKey: '<STIMA_API_KEY>', // Please ensure that the Stima API key is set in the environment variables
  baseURL: 'https://api.apertis.ai/v1', // Replace with Stima API endpoint
});


async function getChatCompletion(prompt: string): Promise<void> {
  try {
    const chatCompletion = await openai.chat.completions.create({
      model: '<MODEL_ALIAS>', // Replace with the model you want to use
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.7,
    });

    console.log(chatCompletion.choices[0].message.content);
  } catch (error) {
    console.error('Error fetching chat completion:', error);
  }
}

// Example usage
getChatCompletion('Hello world');
```

### cURL

To use `cURL` to call Stima API, you only need to modify the `api_key` and `model` variables to call all supported models.  
Please replace `<STIMA_API_KEY>` and `model` values with your **API Key** and **model alias**.

```bash
curl https://api.apertis.ai/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <STIMA_API_KEY>" \
    -d '{
        "model": "<MODEL_ALIAS>",
        "messages": [
            {
                "role": "system",
                "content": "Hello World!"
            }
        ]
    }'

``` 