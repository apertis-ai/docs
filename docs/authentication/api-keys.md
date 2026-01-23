# API Keys

API keys are used to authenticate requests to the Apertis API. This guide explains how to obtain, manage, and secure your API keys.

## Obtaining Your API Key

1. **Sign up or log in** to your account at [Apertis](https://apertis.ai/login)
2. Navigate to **API Keys** section in the dashboard
3. Click **Create New Key** to generate a new API key
4. Copy and securely store your API key - it will only be shown once

:::warning Important
Your API key is displayed only once upon creation. Store it securely immediately. If you lose your key, you'll need to create a new one.
:::

## API Key Format

Apertis API keys follow this format:

```
sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- **Prefix**: `sk-` (standard key) or `sk-sub-` (subscription key)
- **Length**: 32+ characters after the prefix
- **Characters**: Alphanumeric (a-z, A-Z, 0-9)

## Using Your API Key

### Authentication Methods

Apertis supports two authentication methods:

| Method | Header | Example |
|--------|--------|---------|
| Bearer Token | `Authorization` | `Authorization: Bearer sk-your-api-key` |
| API Key | `x-api-key` | `x-api-key: sk-your-api-key` |

Both methods work across all endpoints. The `x-api-key` header provides compatibility with Anthropic SDKs.

### Example: Bearer Token (OpenAI SDKs)

```bash
curl https://api.apertis.ai/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Example: x-api-key (Anthropic SDKs)

```bash
curl https://api.apertis.ai/v1/messages \
  -H "x-api-key: sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4.5",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

:::tip
When both headers are provided, `Authorization` takes precedence over `x-api-key`.
:::

### Python Example

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-api-key",
    base_url="https://api.apertis.ai/v1"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)
```

### Node.js Example

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-api-key',
  baseURL: 'https://api.apertis.ai/v1'
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }]
});

console.log(response.choices[0].message.content);
```

## API Key Settings

### Quota Management

Each API key has its own quota allocation:

| Setting | Description |
|---------|-------------|
| **Remaining Quota** | Available balance for API calls |
| **Used Quota** | Total amount consumed |
| **Unlimited** | Option to set unlimited quota |

### Model Restrictions

You can restrict which models an API key can access:

- **All Models**: Access to all available models (default)
- **Specific Models**: Whitelist only certain models

Example: Restrict a key to only use `gpt-4o` and `claude-sonnet-4.5`:

```
Model Whitelist: gpt-4o, claude-sonnet-4.5
```

### IP Whitelisting (Subnet Restrictions)

For enhanced security, you can restrict API key usage to specific IP addresses or subnets:

```
Allowed IPs: 192.168.1.0/24, 10.0.0.1
```

This ensures your API key can only be used from authorized networks.

### Expiration Date

Set an expiration date for temporary or project-specific keys:

- **Never Expire**: Key remains valid indefinitely
- **Custom Date**: Key expires on a specific date

## Types of API Keys

### Standard API Keys (`sk-`)

- Created manually by users
- Configurable quota and restrictions
- Suitable for development and production use

### Subscription API Keys (`sk-sub-`)

- Automatically generated for subscription plans
- Quota synced with subscription cycle
- Automatically reset when billing cycle renews

## Best Practices

### Security Guidelines

1. **Never expose your API key in client-side code**
   ```javascript
   // DON'T do this in frontend code
   const apiKey = "sk-your-api-key"; // Exposed to users!
   ```

2. **Use environment variables**
   ```bash
   export APERTIS_API_KEY="sk-your-api-key"
   ```
   ```python
   import os
   api_key = os.environ.get("APERTIS_API_KEY")
   ```

3. **Rotate keys regularly** - Create new keys periodically and deprecate old ones

4. **Use separate keys for different environments**
   - Development key with limited quota
   - Production key with appropriate restrictions

5. **Enable IP whitelisting** for production keys when possible

### Quota Management Tips

- Monitor your usage regularly in the dashboard
- Set up alerts for low quota warnings
- Use model restrictions to prevent unexpected costs
- Consider using subscription plans for predictable budgeting

## Managing Multiple Keys

You can create multiple API keys for different purposes:

| Use Case | Recommended Settings |
|----------|---------------------|
| Development | Low quota, all models, no IP restriction |
| Production | Higher quota, specific models, IP whitelist |
| Testing | Limited quota, expiration date set |
| Third-party Integration | Minimal quota, specific models only |

## Revoking API Keys

To revoke an API key:

1. Go to **API Keys** in your dashboard
2. Find the key you want to revoke
3. Click **Delete** or **Disable**

:::caution
Revoking a key is immediate and cannot be undone. Any applications using that key will stop working immediately.
:::

## Troubleshooting

### Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Invalid or missing API key | Check key is correct and included in header |
| `403 Forbidden` | Key doesn't have access to model | Check model restrictions on your key |
| `429 Too Many Requests` | Rate limit exceeded | Reduce request frequency or upgrade plan |
| `402 Payment Required` | Quota exhausted | Add more quota or enable PAYG fallback |

## Related Topics

- [Subscription Plans](../billing/subscription-plans) - Learn about quota and billing
- [Rate Limits](../billing/rate-limits) - Understand request limits
- [Error Codes](../help/error-codes) - Complete error reference
