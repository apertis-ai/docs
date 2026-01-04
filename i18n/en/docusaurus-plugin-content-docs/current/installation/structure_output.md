# Structured Output

Through Stima API's structured output feature, developers can convert API responses into specific JSON formats, which is particularly useful for application scenarios requiring specific data structures.

## Use Example 
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

## Parameter
- `model`: See [Model List](https://api.apertis.ai/models).
- `STIMA_API_KEY`: Your Stima [API Key](https://api.apertis.ai/token).
