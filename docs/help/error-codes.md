# Error Codes

This reference documents all error codes returned by the Apertis API, along with their meanings and recommended solutions.

## Error Response Format

All API errors follow this structure:

```json
{
  "error": {
    "message": "Human-readable error description",
    "type": "error_category",
    "code": "specific_error_code",
    "param": "parameter_name"  // Optional: which parameter caused the error
  }
}
```

## HTTP Status Codes

### Quick Reference

| Status | Meaning | Action |
|--------|---------|--------|
| 200 | Success | Request completed |
| 400 | Bad Request | Fix request parameters |
| 401 | Unauthorized | Check API key |
| 402 | Payment Required | Add quota/funds |
| 403 | Forbidden | Check permissions |
| 404 | Not Found | Check endpoint/model |
| 429 | Too Many Requests | Reduce request rate |
| 500 | Server Error | Retry or contact support |
| 502 | Bad Gateway | Retry request |
| 503 | Service Unavailable | Check status page |

---

## Authentication Errors (401)

### `invalid_api_key`

```json
{
  "error": {
    "message": "Invalid API key provided",
    "type": "authentication_error",
    "code": "invalid_api_key"
  }
}
```

**Causes:**
- API key doesn't exist
- API key was deleted
- Typo in API key

**Solutions:**
1. Verify key in dashboard
2. Create a new key if needed
3. Check for copy/paste errors

### `missing_api_key`

```json
{
  "error": {
    "message": "API key is missing",
    "type": "authentication_error",
    "code": "missing_api_key"
  }
}
```

**Solution:**
Add the Authorization header:
```bash
-H "Authorization: Bearer sk-your-api-key"
```

### `expired_api_key`

```json
{
  "error": {
    "message": "API key has expired",
    "type": "authentication_error",
    "code": "expired_api_key"
  }
}
```

**Solution:**
Create a new API key or extend the expiration date.

---

## Billing Errors (402)

### `quota_exceeded`

```json
{
  "error": {
    "message": "You have exceeded your quota",
    "type": "billing_error",
    "code": "quota_exceeded"
  }
}
```

**Causes:**
- API key quota exhausted
- Account balance depleted
- Subscription quota used up

**Solutions:**
1. Top up account balance
2. Enable PAYG fallback (for subscriptions)
3. Upgrade subscription plan
4. Wait for quota reset (subscription)

### `insufficient_balance`

```json
{
  "error": {
    "message": "Insufficient account balance",
    "type": "billing_error",
    "code": "insufficient_balance"
  }
}
```

**Solution:**
Add funds to your account via the dashboard.

### `subscription_expired`

```json
{
  "error": {
    "message": "Your subscription has expired",
    "type": "billing_error",
    "code": "subscription_expired"
  }
}
```

**Solution:**
Renew your subscription or switch to PAYG.

### `payment_failed`

```json
{
  "error": {
    "message": "Payment processing failed",
    "type": "billing_error",
    "code": "payment_failed"
  }
}
```

**Solutions:**
1. Check payment method is valid
2. Ensure sufficient funds on card
3. Try a different payment method

---

## Permission Errors (403)

### `access_denied`

```json
{
  "error": {
    "message": "Access denied to this resource",
    "type": "permission_error",
    "code": "access_denied"
  }
}
```

**Causes:**
- Account suspended
- Resource access restricted
- IP not in whitelist

### `model_access_denied`

```json
{
  "error": {
    "message": "Your API key does not have access to this model",
    "type": "permission_error",
    "code": "model_access_denied"
  }
}
```

**Solutions:**
1. Check API key model restrictions
2. Use a different API key
3. Update key permissions

### `ip_not_allowed`

```json
{
  "error": {
    "message": "Request from this IP is not allowed",
    "type": "permission_error",
    "code": "ip_not_allowed"
  }
}
```

**Solution:**
Add your IP address to the API key's whitelist.

### `account_suspended`

```json
{
  "error": {
    "message": "Your account has been suspended",
    "type": "permission_error",
    "code": "account_suspended"
  }
}
```

**Solution:**
Contact support at hi@apertis.ai

---

## Not Found Errors (404)

### `model_not_found`

```json
{
  "error": {
    "message": "The model 'xyz' does not exist",
    "type": "invalid_request_error",
    "code": "model_not_found"
  }
}
```

**Solutions:**
1. Check model name spelling
2. List available models: `GET /v1/models`
3. Model may be deprecated

### `endpoint_not_found`

```json
{
  "error": {
    "message": "The requested endpoint does not exist",
    "type": "invalid_request_error",
    "code": "endpoint_not_found"
  }
}
```

**Solution:**
Check the API endpoint path.

---

## Validation Errors (400)

### `invalid_request`

```json
{
  "error": {
    "message": "Invalid request format",
    "type": "invalid_request_error",
    "code": "invalid_request"
  }
}
```

**Common causes:**
- Malformed JSON
- Invalid Content-Type
- Missing required fields

### `invalid_parameter`

```json
{
  "error": {
    "message": "Invalid value for parameter 'temperature'",
    "type": "invalid_request_error",
    "code": "invalid_parameter",
    "param": "temperature"
  }
}
```

**Solution:**
Check parameter constraints:

| Parameter | Valid Range |
|-----------|-------------|
| temperature | 0.0 - 2.0 |
| top_p | 0.0 - 1.0 |
| max_tokens | 1 - model limit |
| n | 1 - 128 |

### `missing_parameter`

```json
{
  "error": {
    "message": "Missing required parameter 'messages'",
    "type": "invalid_request_error",
    "code": "missing_parameter",
    "param": "messages"
  }
}
```

**Solution:**
Include all required parameters in your request.

### `context_length_exceeded`

```json
{
  "error": {
    "message": "Maximum context length exceeded",
    "type": "invalid_request_error",
    "code": "context_length_exceeded"
  }
}
```

**Solutions:**
1. Reduce prompt length
2. Use a model with larger context
3. Summarize previous messages

| Model | Context Limit |
|-------|---------------|
| GPT-3.5 Turbo | 16K tokens |
| GPT-4o | 128K tokens |
| Claude Sonnet 4.5 | 200K tokens |

### `invalid_image`

```json
{
  "error": {
    "message": "Invalid image format or size",
    "type": "invalid_request_error",
    "code": "invalid_image"
  }
}
```

**Solutions:**
1. Use supported formats (PNG, JPEG, WebP, GIF)
2. Reduce image size (max 20MB)
3. Check base64 encoding

---

## Rate Limit Errors (429)

### `rate_limit_exceeded`

```json
{
  "error": {
    "message": "Rate limit exceeded. Please wait before making more requests.",
    "type": "rate_limit_error",
    "code": "rate_limit_exceeded"
  }
}
```

**Response Headers:**
```
X-RateLimit-Limit: 1500
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1703894400
Retry-After: 45
```

**Solutions:**
1. Wait for `Retry-After` seconds
2. Implement exponential backoff
3. Reduce request frequency
4. Upgrade plan for higher limits

---

## Server Errors (5xx)

### `internal_error` (500)

```json
{
  "error": {
    "message": "An internal server error occurred",
    "type": "server_error",
    "code": "internal_error"
  }
}
```

**Solutions:**
1. Retry the request
2. Check status page
3. Contact support if persistent

### `service_unavailable` (503)

```json
{
  "error": {
    "message": "Service temporarily unavailable",
    "type": "server_error",
    "code": "service_unavailable"
  }
}
```

**Solutions:**
1. Wait a few minutes
2. Check status page
3. Retry with exponential backoff

### `model_overloaded` (503)

```json
{
  "error": {
    "message": "The model is currently overloaded",
    "type": "server_error",
    "code": "model_overloaded"
  }
}
```

**Solutions:**
1. Use fallback models
2. Retry after a delay
3. Try a different model

### `upstream_error` (502)

```json
{
  "error": {
    "message": "Error communicating with upstream provider",
    "type": "server_error",
    "code": "upstream_error"
  }
}
```

**Solutions:**
1. Retry the request
2. Enable fallback models
3. Check provider status

---

## Model-Specific Errors

### `content_policy_violation`

```json
{
  "error": {
    "message": "Content violates usage policies",
    "type": "content_policy_error",
    "code": "content_policy_violation"
  }
}
```

**Solution:**
Review and modify your prompt to comply with usage policies.

### `output_length_exceeded`

```json
{
  "error": {
    "message": "Output exceeds maximum length",
    "type": "invalid_request_error",
    "code": "output_length_exceeded"
  }
}
```

**Solution:**
Set a lower `max_tokens` value or request shorter responses.

---

## Error Handling Best Practices

### Python Example

```python
from openai import OpenAI, APIError, RateLimitError, AuthenticationError

client = OpenAI(
    api_key="sk-your-api-key",
    base_url="https://api.apertis.ai/v1"
)

try:
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Hello"}]
    )
except AuthenticationError as e:
    print(f"Authentication failed: {e}")
    # Check API key
except RateLimitError as e:
    print(f"Rate limited: {e}")
    # Implement retry with backoff
except APIError as e:
    print(f"API error: {e.status_code} - {e.message}")
    # Handle other errors
```

### Node.js Example

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-api-key',
  baseURL: 'https://api.apertis.ai/v1'
});

try {
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Hello' }]
  });
} catch (error) {
  if (error.status === 401) {
    console.error('Authentication failed');
  } else if (error.status === 429) {
    console.error('Rate limited, retrying...');
  } else if (error.status >= 500) {
    console.error('Server error, please retry');
  } else {
    console.error(`Error: ${error.message}`);
  }
}
```

### Retry with Exponential Backoff

```python
import time
import random

def make_request_with_retry(func, max_retries=5):
    for attempt in range(max_retries):
        try:
            return func()
        except RateLimitError:
            if attempt == max_retries - 1:
                raise
            wait_time = (2 ** attempt) + random.uniform(0, 1)
            time.sleep(wait_time)
        except APIError as e:
            if e.status_code >= 500 and attempt < max_retries - 1:
                time.sleep(2 ** attempt)
                continue
            raise
```

---

## Related Topics

- [Troubleshooting](./troubleshooting) - Common issues and solutions
- [Rate Limits](../billing/rate-limits) - Understanding rate limits
- [API Keys](../authentication/api-keys) - API key management
