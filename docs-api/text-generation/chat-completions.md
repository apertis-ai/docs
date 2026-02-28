# Chat Completion
```json
/v1/chat/completions
```

## HTTP Request

```bash
curl https://api.apertis.ai/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
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

- `<APERTIS_API_KEY>`: Your API key
- `<MODEL_ALIAS>`: The alias of the model to use
- `<MESSAGES>`: The messages to send to the model

## Optional Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `temperature` | number | Sampling temperature (0-2). Default: 1 |
| `max_tokens` | integer | Maximum tokens in the response |
| `top_p` | number | Nucleus sampling threshold (0-1) |
| `stream` | boolean | Enable streaming. Default: false |
| `compression` | object | [Context compression](./context-compression) configuration |

### Context Compression

Add a `compression` object to automatically summarize older conversation history and reduce token usage for long conversations:

```bash
curl https://api.apertis.ai/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "gpt-4.1-mini",
        "messages": [{"role": "user", "content": "Hello!"}],
        "compression": {"enabled": true}
    }'
```

See [Context Compression](./context-compression) for full documentation.

