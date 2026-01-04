# Chat Completion
```json
/v1/chat/completions
```

## HTTP Request

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

- `<STIMA_API_KEY>`: Your API key
- `<MODEL_ALIAS>`: The alias of the model to use
- `<MESSAGES>`: The messages to send to the model

