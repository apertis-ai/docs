# Fallback Models

Apertis provides a powerful fallback model mechanism that automatically switches to backup models when the primary model request fails, ensuring high availability and service stability.

## Overview

The fallback model mechanism automatically handles the following scenarios:
- Model service timeouts or unresponsiveness
- Network connectivity issues
- Specified model temporarily unavailable
- Service provider temporary outages

When the primary model fails, the system will attempt backup models in your specified priority order until one succeeds.

## Configuration Methods

### Request-Level Configuration (Highest Priority)

You can specify fallback model configuration directly in each API request:

```json
{
  "model": "gpt-4",
  "messages": [
    {"role": "user", "content": "Hello, how are you?"}
  ],
  "fallback_models": ["gpt-3.5-turbo", "claude-3-haiku-20240307"],
  "fallback_timeout": 25000,
  "fallback_enabled": true
}
```

### Token-Level Configuration

You can also pre-configure fallback models in your API Token settings, which will automatically apply to all requests using that token.

## Parameter Reference

### `fallback_models`
- **Type**: Array of strings
- **Description**: List of fallback models in priority order
- **Limit**: Maximum 5 fallback models
- **Example**: `["gpt-3.5-turbo", "claude-3-haiku-20240307", "gemini-pro"]`

### `fallback_timeout`
- **Type**: Integer
- **Unit**: Milliseconds (ms)
- **Range**: 5,000 - 300,000 milliseconds (5 - 300 seconds)
- **Default**: 15,000 milliseconds (15 seconds)
- **Description**: Wait time before switching to the next fallback model. Automatically capped by remaining `X-Timeout` budget.

### `fallback_enabled`
- **Type**: Boolean
- **Default**: false
- **Description**: Whether to enable the fallback model mechanism

## Fallback Trigger Conditions

The system automatically triggers fallback models in the following situations:

### 1. Timeout Errors
- Request exceeds the configured `fallback_timeout` duration
- Context deadline exceeded

### 2. Connection Errors
- Connection refused
- Connection reset
- Network unreachable
- DNS resolution failures

### 3. Model Errors
- Model not found
- Invalid model
- Model temporarily unavailable

### 4. HTTP Status Errors
- Non-200 HTTP status codes

## Request Examples

### Python Examples

```python
import openai

# Configure Apertis
client = openai.OpenAI(
    api_key="your-stima-api-key",
    base_url="https://api.apertis.ai/v1"
)

# Chat request with fallback models
response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "user", "content": "Hello, how are you?"}
    ],
    # Fallback configuration
    extra_body={
        "fallback_models": ["gpt-3.5-turbo", "claude-3-haiku-20240307"],
        "fallback_timeout": 25000,  # 25 second timeout
        "fallback_enabled": True
    }
)

print(response.choices[0].message.content)

# Check if fallback model was used
if hasattr(response, 'headers'):
    if response.headers.get('X-Fallback-Used') == 'true':
        print(f"Fallback model used: {response.headers.get('X-Actual-Model')}")
        print(f"Original model: {response.headers.get('X-Fallback-From')}")
        print(f"Fallback reason: {response.headers.get('X-Fallback-Reason')}")
```

### Complete Example with requests Library

```python
import requests
import json

url = "https://api.apertis.ai/v1/chat/completions"
headers = {
    "Authorization": "Bearer your-stima-api-key",
    "Content-Type": "application/json"
}

payload = {
    "model": "gpt-4",
    "messages": [
        {"role": "user", "content": "Write a Python function for me"}
    ],
    "fallback_models": ["gpt-3.5-turbo", "claude-3-haiku-20240307"],
    "fallback_timeout": 20000,
    "fallback_enabled": True
}

try:
    response = requests.post(url, headers=headers, json=payload, timeout=60)
    
    # Check fallback model usage
    fallback_used = response.headers.get('X-Fallback-Used', 'false')
    if fallback_used == 'true':
        print(f"Fallback model activated!")
        print(f"Original model: {response.headers.get('X-Fallback-From')}")
        print(f"Actual model used: {response.headers.get('X-Actual-Model')}")
        print(f"Fallback reason: {response.headers.get('X-Fallback-Reason')}")
    
    result = response.json()
    print(result['choices'][0]['message']['content'])
    
except requests.exceptions.RequestException as e:
    print(f"Request failed: {e}")
```

### cURL Examples

```bash
# Basic fallback request
curl -X POST "https://api.apertis.ai/v1/chat/completions" \
  -H "Authorization: Bearer your-stima-api-key" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "fallback_models": ["gpt-3.5-turbo", "claude-3-haiku-20240307"],
    "fallback_timeout": 25000,
    "fallback_enabled": true
  }' \
  -w "\nStatus: %{http_code}\nResponse time: %{time_total}s\n" \
  -v
```

### cURL Example with Header Inspection

```bash
# Display full headers to check fallback usage
curl -X POST "https://api.apertis.ai/v1/chat/completions" \
  -H "Authorization: Bearer your-stima-api-key" \
  -H "Content-Type: application/json" \
  -D headers.txt \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Test fallback mechanism"}
    ],
    "fallback_models": ["gpt-3.5-turbo"],
    "fallback_timeout": 15000,
    "fallback_enabled": true
  }'

# Check fallback-related headers
echo "Fallback usage information:"
grep -i "x-fallback" headers.txt
```

## Response Headers

When using the fallback model mechanism, the API response includes the following custom headers:

| Header Name | Description | Example Value |
|-------------|-------------|---------------|
| `X-Fallback-Used` | Whether fallback model was used | `true` / `false` |
| `X-Fallback-From` | Original requested model name | `gpt-4` |
| `X-Actual-Model` | Actually used model name | `gpt-3.5-turbo` |
| `X-Fallback-Reason` | Reason for triggering fallback | `primary_model_failed` |

## Timeout Architecture

There are two timeout layers that work together:

| Layer | Controls | Header / Parameter | Default |
|-------|----------|-------------------|---------|
| **Total Request Timeout** | Entire request lifecycle (channel retries + model fallback) | `X-Timeout` header | 60s |
| **Per-Model Fallback Timeout** | How long to wait on each fallback model before trying the next | `fallback_timeout` body param | 15s |

**How they interact:**
- `X-Timeout` caps the **total** time. If 40 seconds were spent on channel retries, only 20 seconds remain for fallback models.
- `fallback_timeout` controls per-model patience within the remaining budget. If `fallback_timeout` exceeds the remaining total time, it is automatically reduced.
- For streaming requests, both timers stop once the upstream starts sending data.

```
X-Timeout: 60000 (total budget)
├── Channel retries: 25s used
└── Fallback models: 35s remaining
    ├── gpt-3.5-turbo: fallback_timeout=15s → wait up to 15s
    └── claude-3-haiku: fallback_timeout=15s → wait up to 20s (capped by remaining)
```

### Subscription Users

Subscription plan users can configure the **Fallback Timeout** in the dashboard:

**Settings → API Keys → Fallback Timeout**

This sets the per-model fallback timeout (5–300 seconds) at the token level, applying to all requests made with that token. Request-level `fallback_timeout` overrides this setting.

## Configuration Priority

1. **Request Level** - `fallback_*` parameters in API request (highest priority)
2. **Token Level** - Fallback model configuration in API Token settings (configurable at **Settings → API Keys**)
3. **System Default** - 15 second per-attempt timeout, fallback disabled

## Best Practices

### 1. Choose Appropriate Fallback Models
- Select fast-responding models as backups
- Consider cost factors, fallback from expensive to cheaper models
- Ensure fallback models support the same features

### 2. Set Reasonable Timeout Values
- General recommendation: 20-30 seconds
- Complex tasks: 60-120 seconds
- Real-time chat: 10-15 seconds

### 3. Fallback Model Count
- Recommend 1-3 fallback models
- Too many fallback models increase total response time
- System limit: maximum 5 fallback models

## Monitoring and Debugging

### Check Fallback Usage

```python
# Python example: Check response headers
def check_fallback_usage(response):
    headers = response.headers if hasattr(response, 'headers') else {}
    
    fallback_used = headers.get('X-Fallback-Used', 'false')
    if fallback_used == 'true':
        print("Fallback model information:")
        print(f"  Original model: {headers.get('X-Fallback-From')}")
        print(f"  Actual model: {headers.get('X-Actual-Model')}")
        print(f"  Fallback reason: {headers.get('X-Fallback-Reason')}")
    else:
        print("Using original model, no fallback triggered")
```

### Common Issues

**Q: Why wasn't the fallback model triggered?**
A: Check if `fallback_enabled` is set to `true` and `fallback_models` is properly configured.

**Q: What happens when all fallback models fail?**
A: The system returns the error from the last attempted fallback model. Check model availability and network connectivity.

**Q: How to track fallback model usage frequency?**
A: Monitor the `X-Fallback-Used` header in responses to track fallback usage statistics.

## Billing Information

- Each model is billed at its standard rate
- When using fallback models, billing is based on the actually used model
- Use the `X-Actual-Model` header to confirm the billing model