# 結構化輸出

透過 Stima API 的結構化輸出功能，開發者可以將 API 的回應轉換為特定的 JSON 格式，這對於需要特定資料結構的應用場景非常有用。

## 使用方式 (以 Python 為例)
```
import http.client
import json

conn = http.client.HTTPSConnection("api.apertis.ai")
payload = json.dumps({
   "model": "gpt-4o",
   "messages": [
      {
         "role": "system",
         "content": "You are a helpful math tutor. Guide the user through the solution step by step."
      },
      {
         "role": "user",
         "content": "how can I solve 8x + 7 = -23"
      }
   ],
   "response_format": {
      "type": "json_schema",
      "json_schema": {
         "name": "math_reasoning",
         "schema": {
            "type": "object",
            "properties": {
               "steps": {
                  "type": "array",
                  "items": {
                     "type": "object",
                     "properties": {
                        "explanation": {
                           "type": "string"
                        },
                        "output": {
                           "type": "string"
                        }
                     },
                     "required": [
                        "explanation",
                        "output"
                     ],
                     "additionalProperties": False
                  }
               },
               "final_answer": {
                  "type": "string"
               }
            },
            "required": [
               "steps",
               "final_answer"
            ],
            "additionalProperties": False
         },
         "strict": True
      }
   }
})
headers = {
   'Accept': 'application/json',
   'Authorization': 'Bearer <STIMA_API_KEY>',
   'Content-Type': 'application/json'
}
conn.request("POST", "/v1/chat/completions", payload, headers)
res = conn.getresponse()
data = res.read()
print(data.decode("utf-8"))
```

## 參數說明

- `model`: 請見[模型列表](https://api.apertis.ai/models)。
- `STIMA_API_KEY`: 您的 API 金鑰。
