# Troubleshooting

This guide helps you diagnose and resolve common issues when using the Apertis API.

## Quick Diagnostics

### Test Your API Key

Verify your API key is working:

```bash
curl https://api.stima.tech/v1/models \
  -H "Authorization: Bearer sk-your-api-key"
```

**Expected Response:**
```json
{
  "object": "list",
  "data": [
    {"id": "gpt-4o", "object": "model", ...},
    ...
  ]
}
```

### Check API Status

Visit our status page: [status.stima.tech](https://status.stima.tech)

## Common Issues

### Authentication Errors

#### 401 Unauthorized

**Symptoms:**
```json
{
  "error": {
    "message": "Invalid API key",
    "type": "authentication_error",
    "code": "invalid_api_key"
  }
}
```

**Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Missing API key | Add `Authorization: Bearer sk-xxx` header |
| Typo in API key | Copy key directly from dashboard |
| Expired API key | Check expiration date, create new key |
| Deleted API key | Create a new API key |

**Debug Steps:**

1. Verify the `Authorization` header format:
   ```
   Authorization: Bearer sk-your-api-key
   ```
   Note: Include `Bearer ` (with space) before the key

2. Check for invisible characters:
   ```python
   api_key = api_key.strip()  # Remove whitespace
   ```

3. Test with a fresh key to rule out key issues

#### 403 Forbidden

**Symptoms:**
```json
{
  "error": {
    "message": "Access denied",
    "type": "permission_error",
    "code": "access_denied"
  }
}
```

**Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Model not in whitelist | Check key's model restrictions |
| IP not whitelisted | Add your IP to allowed list |
| Account suspended | Contact support |

### Quota & Billing Errors

#### 402 Payment Required

**Symptoms:**
```json
{
  "error": {
    "message": "Quota exceeded",
    "type": "billing_error",
    "code": "quota_exceeded"
  }
}
```

**Solutions:**

1. **Check your quota** in the dashboard
2. **Top up your balance** if using PAYG
3. **Enable PAYG fallback** for subscription users:
   - Dashboard → Billing → Enable PAYG Fallback
4. **Upgrade your plan** for more quota

#### Subscription Token Not Working

If your subscription token (`sk-sub-xxx`) isn't working:

1. **Check subscription status:**
   - Active? Suspended? Expired?

2. **Verify quota remaining:**
   - Subscription quota may be exhausted
   - PAYG fallback may be disabled

3. **Check billing cycle:**
   - Quota resets at cycle start
   - View cycle dates in dashboard

### Rate Limiting

#### 429 Too Many Requests

**Symptoms:**
```json
{
  "error": {
    "message": "Rate limit exceeded",
    "type": "rate_limit_error",
    "code": "rate_limit_exceeded"
  }
}
```

**Immediate Actions:**

1. **Wait and retry** - Rate limits reset after the window expires
2. **Check rate limit headers** for reset time:
   ```
   X-RateLimit-Reset: 1703894400
   ```

**Long-term Solutions:**

1. **Implement exponential backoff:**
   ```python
   import time

   def retry_with_backoff(func, max_retries=5):
       for i in range(max_retries):
           try:
               return func()
           except RateLimitError:
               wait = (2 ** i) + random.random()
               time.sleep(wait)
       raise Exception("Max retries exceeded")
   ```

2. **Reduce request frequency** - Batch operations when possible

3. **Use multiple API keys** to distribute load

4. **Upgrade your plan** for higher limits

### Model Errors

#### Model Not Found

**Symptoms:**
```json
{
  "error": {
    "message": "Model 'xyz' not found",
    "type": "invalid_request_error",
    "code": "model_not_found"
  }
}
```

**Solutions:**

1. **Check model name spelling:**
   ```python
   # Correct
   model = "gpt-4o"

   # Incorrect
   model = "gpt4o"  # Missing hyphen
   model = "GPT-4o"  # Case sensitive
   ```

2. **List available models:**
   ```bash
   curl https://api.stima.tech/v1/models \
     -H "Authorization: Bearer sk-your-api-key"
   ```

3. **Check model availability:**
   - Some models may be temporarily unavailable
   - Check status page for outages

#### Model Access Denied

Your API key may not have access to the requested model:

1. Check model restrictions on your key
2. Verify your plan includes the model
3. Some models require special access

### Request Errors

#### 400 Bad Request

**Common causes:**

1. **Invalid JSON:**
   ```json
   // Wrong - trailing comma
   {"model": "gpt-4o", "messages": [],}

   // Correct
   {"model": "gpt-4o", "messages": []}
   ```

2. **Missing required fields:**
   ```python
   # Wrong - missing messages
   client.chat.completions.create(model="gpt-4o")

   # Correct
   client.chat.completions.create(
       model="gpt-4o",
       messages=[{"role": "user", "content": "Hello"}]
   )
   ```

3. **Invalid parameter values:**
   ```python
   # Wrong - temperature out of range
   temperature=3.0

   # Correct
   temperature=0.7  # Range: 0-2
   ```

#### Request Timeout

**Symptoms:**
- Connection timeout
- Read timeout
- No response

**Solutions:**

1. **Increase timeout settings:**
   ```python
   client = OpenAI(
       api_key="sk-xxx",
       base_url="https://api.stima.tech/v1",
       timeout=120.0  # 120 seconds
   )
   ```

2. **Use streaming for long responses:**
   ```python
   response = client.chat.completions.create(
       model="gpt-4o",
       messages=[...],
       stream=True  # Enable streaming
   )
   ```

3. **Check for large payloads:**
   - Long prompts take longer to process
   - Consider breaking into smaller chunks

### Connection Issues

#### SSL/TLS Errors

**Symptoms:**
```
SSL: CERTIFICATE_VERIFY_FAILED
```

**Solutions:**

1. **Update SSL certificates:**
   ```bash
   # Python
   pip install --upgrade certifi

   # macOS
   /Applications/Python\ 3.x/Install\ Certificates.command
   ```

2. **Check system time** - SSL validation requires correct time

3. **Corporate proxy issues:**
   - Configure proxy settings correctly
   - May need to add proxy CA certificates

#### DNS Resolution Errors

**Symptoms:**
```
Failed to resolve 'api.stima.tech'
```

**Solutions:**

1. **Check internet connection**
2. **Try alternative DNS:**
   ```bash
   # Use Google DNS
   nslookup api.stima.tech 8.8.8.8
   ```
3. **Flush DNS cache:**
   ```bash
   # macOS
   sudo dscacheutil -flushcache

   # Windows
   ipconfig /flushdns
   ```

### Streaming Issues

#### Incomplete Streaming Response

**Symptoms:**
- Stream stops mid-response
- Missing content

**Solutions:**

1. **Handle stream properly:**
   ```python
   full_response = ""
   for chunk in response:
       if chunk.choices[0].delta.content:
           full_response += chunk.choices[0].delta.content
   ```

2. **Check for connection issues:**
   - Unstable network can interrupt streams
   - Consider retry logic for incomplete streams

3. **Increase read timeout:**
   ```python
   client = OpenAI(
       api_key="sk-xxx",
       base_url="https://api.stima.tech/v1",
       timeout=httpx.Timeout(60.0, read=300.0)
   )
   ```

## Debugging Tools

### Enable Verbose Logging

**Python:**
```python
import logging
import httpx

logging.basicConfig(level=logging.DEBUG)
httpx_logger = logging.getLogger("httpx")
httpx_logger.setLevel(logging.DEBUG)
```

**cURL:**
```bash
curl -v https://api.stima.tech/v1/models \
  -H "Authorization: Bearer sk-your-api-key"
```

### Request/Response Inspection

**Python:**
```python
response = client.chat.completions.with_raw_response.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}]
)

print(f"Status: {response.status_code}")
print(f"Headers: {response.headers}")
print(f"Body: {response.text}")
```

## Environment-Specific Issues

### Python

#### OpenAI SDK Version

Ensure you're using a compatible SDK version:

```bash
pip install --upgrade openai
```

Check version:
```python
import openai
print(openai.__version__)  # Should be >= 1.0.0
```

### Node.js

#### Package Version

```bash
npm install openai@latest
```

#### ES Modules vs CommonJS

```javascript
// ES Modules
import OpenAI from 'openai';

// CommonJS
const OpenAI = require('openai');
```

### Docker/Container

#### DNS Issues in Containers

Add DNS settings to your container:

```dockerfile
# Dockerfile
RUN echo "nameserver 8.8.8.8" > /etc/resolv.conf
```

Or in docker-compose:
```yaml
services:
  app:
    dns:
      - 8.8.8.8
      - 8.8.4.4
```

## Getting Help

### Before Contacting Support

1. **Check this troubleshooting guide**
2. **Review [Error Codes](./error-codes)**
3. **Search our documentation**
4. **Check [Status Page](https://status.stima.tech)**

### Information to Include

When contacting support, provide:

- **Request ID** (from response headers if available)
- **Timestamp** of the issue
- **Error message** (full JSON response)
- **Code snippet** (sanitize API key)
- **Environment** (Python version, SDK version, OS)

### Contact Support

- **Email:** hi@apertis.ai
- **Dashboard:** Submit a ticket through the dashboard

## Related Topics

- [Error Codes](./error-codes) - Complete error reference
- [API Keys](../authentication/api-keys) - API key management
- [Rate Limits](../billing/rate-limits) - Understanding rate limits
