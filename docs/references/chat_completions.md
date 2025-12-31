# Chat Completions
```json
/v1/chat/completions
```

## HTTP 請求

```bash
curl https://api.apertis.ai/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <STIMA_API_KEY>" \
    -d '{
        "model": "<MODEL_ALIAS>",
        "messages": [
            {
                "role": "system",
                "content": "<MESSAGES>"
            }
        ]
    }'
```

- `<STIMA_API_KEY>`: 您的 API 金鑰
- `<MODEL_ALIAS>`: 要使用的模型
- `<MESSAGES>`: 要傳送給模型的訊息

