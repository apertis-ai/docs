# Rate Limits

Apertis implements rate limits to ensure fair usage and maintain service quality for all users. This guide explains the different rate limits and how to handle them.

## Rate Limit Overview

Rate limits are applied at multiple levels to protect the service:

| Level | Limit | Duration | Scope |
|-------|-------|----------|-------|
| **Global API** | 1,500 requests | 3 minutes | Per IP |
| **API Key** | 3,000 requests | 1 minute | Per Key |
| **Web Dashboard** | 120 requests | 3 minutes | Per IP |
| **Critical Operations** | 20 requests | 20 minutes | Per IP |
| **Log Queries** | 30 requests | 60 seconds | Per User |

## API Rate Limits

### Global API Rate Limit

The primary rate limit for all API endpoints:

```
1,500 requests per 3 minutes per IP address
```

This applies to:
- `/v1/chat/completions`
- `/v1/embeddings`
- `/v1/images/generations`
- All other `/v1/*` endpoints

### Per API Key Rate Limit

Each API key has its own rate limit:

```
3,000 requests per 1 minute per API key
```

This provides higher throughput for applications using a single API key.

### Effective Rate Limit

Your effective rate limit is the **lower** of:
- Global API limit (based on IP)
- API Key limit (based on key)

```
Effective Limit = min(Global Limit, API Key Limit)
```

## Rate Limit Headers

Rate limit information is included in API response headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed |
| `X-RateLimit-Remaining` | Requests remaining in window |
| `X-RateLimit-Reset` | Unix timestamp when limit resets |

### Example Response Headers

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 1500
X-RateLimit-Remaining: 1423
X-RateLimit-Reset: 1703894400
```

## Handling Rate Limits

### HTTP 429 Response

When you exceed the rate limit, the API returns:

```json
{
  "error": {
    "message": "Rate limit exceeded. Please wait before making more requests.",
    "type": "rate_limit_error",
    "code": "rate_limit_exceeded"
  }
}
```

### Retry Strategy

Implement exponential backoff for rate limit errors:

```python
import time
import random
from openai import OpenAI, RateLimitError

client = OpenAI(
    api_key="sk-your-api-key",
    base_url="https://api.apertis.ai/v1"
)

def make_request_with_retry(messages, max_retries=5):
    for attempt in range(max_retries):
        try:
            return client.chat.completions.create(
                model="gpt-4o",
                messages=messages
            )
        except RateLimitError:
            if attempt == max_retries - 1:
                raise

            # Exponential backoff with jitter
            wait_time = (2 ** attempt) + random.uniform(0, 1)
            print(f"Rate limited. Waiting {wait_time:.2f}s...")
            time.sleep(wait_time)
```

### Node.js Example

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-api-key',
  baseURL: 'https://api.apertis.ai/v1'
});

async function makeRequestWithRetry(messages, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await client.chat.completions.create({
        model: 'gpt-4o',
        messages
      });
    } catch (error) {
      if (error.status !== 429 || attempt === maxRetries - 1) {
        throw error;
      }

      // Exponential backoff with jitter
      const waitTime = Math.pow(2, attempt) + Math.random();
      console.log(`Rate limited. Waiting ${waitTime.toFixed(2)}s...`);
      await new Promise(r => setTimeout(r, waitTime * 1000));
    }
  }
}
```

## Best Practices

### 1. Request Batching

Combine multiple operations into fewer requests:

```python
# Instead of multiple single-message calls
for message in messages:
    client.chat.completions.create(messages=[message])  # Many requests

# Batch into single calls when possible
client.chat.completions.create(messages=messages)  # Single request
```

### 2. Implement Request Queuing

Use a queue to manage request rate:

```python
import asyncio
from collections import deque

class RateLimitedQueue:
    def __init__(self, max_requests_per_minute=50):
        self.max_rpm = max_requests_per_minute
        self.queue = deque()
        self.request_times = deque()

    async def add_request(self, request_func):
        # Wait if at rate limit
        while len(self.request_times) >= self.max_rpm:
            oldest = self.request_times[0]
            wait_time = 60 - (time.time() - oldest)
            if wait_time > 0:
                await asyncio.sleep(wait_time)
            self.request_times.popleft()

        # Execute request
        self.request_times.append(time.time())
        return await request_func()
```

### 3. Use Streaming for Long Responses

Streaming doesn't reduce rate limits but improves perceived performance:

```python
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Write a long story"}],
    stream=True
)

for chunk in response:
    print(chunk.choices[0].delta.content, end="")
```

### 4. Cache Responses

Cache identical requests to reduce API calls:

```python
import hashlib
from functools import lru_cache

@lru_cache(maxsize=1000)
def cached_completion(messages_hash, model):
    # Only call API if not in cache
    return client.chat.completions.create(
        model=model,
        messages=messages  # Original messages
    )

# Create hash of messages for cache key
messages_hash = hashlib.md5(str(messages).encode()).hexdigest()
response = cached_completion(messages_hash, "gpt-4o")
```

### 5. Distribute Across Multiple Keys

For high-volume applications, use multiple API keys:

```python
import itertools

api_keys = ["sk-key1", "sk-key2", "sk-key3"]
key_cycle = itertools.cycle(api_keys)

def get_client():
    return OpenAI(
        api_key=next(key_cycle),
        base_url="https://api.apertis.ai/v1"
    )
```

## Special Rate Limits

### Critical Operations

Higher restrictions for security-sensitive operations:

| Operation | Limit | Duration |
|-----------|-------|----------|
| Registration | 20 | 20 minutes |
| Password Reset | 20 | 20 minutes |
| Email Verification | 20 | 20 minutes |

### Log Query Rate Limit

For log and usage queries:

```
30 requests per 60 seconds per user
```

:::note
Root users (administrators) are exempt from log query rate limits.
:::

### Upload/Download Rate Limit

For file operations:

```
10 requests per 60 seconds per IP
```

## Rate Limit Exemptions

### Subscription Users

Subscription plan users may have higher rate limits:

| Plan | Rate Limit Multiplier |
|------|----------------------|
| Lite | 1x (standard) |
| Pro | 1.5x |
| Max | 2x |

### Enterprise

Contact sales for custom rate limits for enterprise applications.

## Monitoring Your Usage

### Dashboard Metrics

View your API usage in the dashboard:

- Requests per minute/hour/day
- Rate limit hits
- Peak usage times

### Programmatic Monitoring

Track rate limits in your application:

```python
def check_rate_limit_headers(response):
    remaining = response.headers.get('X-RateLimit-Remaining')
    reset_time = response.headers.get('X-RateLimit-Reset')

    if remaining and int(remaining) < 100:
        print(f"Warning: Only {remaining} requests remaining")
        print(f"Resets at: {reset_time}")
```

## Troubleshooting

### Consistently Hitting Rate Limits

If you're frequently rate limited:

1. **Audit your request patterns** - Are you making unnecessary calls?
2. **Implement caching** - Cache repeated queries
3. **Optimize batch sizes** - Combine requests where possible
4. **Consider upgrading** - Higher plans have increased limits

### Sudden Rate Limit Errors

If you suddenly start getting rate limited:

1. **Check for loops** - Infinite loops can exhaust limits quickly
2. **Review recent code changes** - New code may have introduced issues
3. **Check for concurrent users** - Multiple processes sharing same key

## Related Topics

- [API Keys](../authentication/api-keys) - Manage API keys and access
- [Subscription Plans](./subscription-plans) - Plan limits and quotas
- [Error Codes](../help/error-codes) - Understanding error responses
