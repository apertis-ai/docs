# Security Best Practices

Protecting your API keys and data is critical. This guide covers security best practices for using the Apertis API safely.

## API Key Security

### Never Expose Keys in Client-Side Code

API keys should never be visible in browser or mobile app code:

```javascript
// ❌ WRONG - Key exposed in frontend
const apiKey = "sk-abc123...";
fetch('https://api.apertis.ai/v1/chat/completions', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});

// ✅ CORRECT - Use backend proxy
fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ message: userMessage })
});
```

### Use Environment Variables

Store API keys in environment variables, not in code:

```bash
# .env file (add to .gitignore!)
APERTIS_API_KEY=sk-your-api-key
```

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("APERTIS_API_KEY"),
    base_url="https://api.apertis.ai/v1"
)
```

### Never Commit Keys to Git

Add sensitive files to `.gitignore`:

```gitignore
# .gitignore
.env
.env.local
.env.production
*.key
config/secrets.yml
```

If you accidentally commit a key:

1. **Immediately revoke** the exposed key in the dashboard
2. **Create a new key** with fresh credentials
3. **Remove from git history** using `git filter-branch` or BFG Repo-Cleaner
4. **Rotate any related credentials**

### Use Secrets Management

For production environments, use proper secrets management:

| Platform | Solution |
|----------|----------|
| AWS | AWS Secrets Manager, Parameter Store |
| GCP | Secret Manager |
| Azure | Key Vault |
| Kubernetes | Secrets, External Secrets Operator |
| Docker | Docker Secrets |
| CI/CD | GitHub Secrets, GitLab CI Variables |

**Example with AWS Secrets Manager:**

```python
import boto3
import json

def get_api_key():
    client = boto3.client('secretsmanager')
    response = client.get_secret_value(SecretId='apertis/api-key')
    secret = json.loads(response['SecretString'])
    return secret['api_key']
```

## Access Control

### Principle of Least Privilege

Grant minimum necessary permissions:

| Use Case | Recommended Settings |
|----------|---------------------|
| Development | Low quota, all models |
| Testing | Limited quota, test models only |
| Production | Appropriate quota, specific models |
| Third-party | Minimal quota, restricted models |

### Model Restrictions

Limit which models each key can access:

```
Production Key:
  ✓ gpt-4o
  ✓ gpt-4o-mini
  ✗ claude-3-opus (expensive)
  ✗ experimental models
```

### IP Whitelisting

Restrict API key usage to known IP addresses:

```
Allowed IPs:
  - 203.0.113.0/24    (Office network)
  - 198.51.100.50     (Production server)
  - 192.0.2.100       (CI/CD runner)
```

**Setting up IP whitelist:**

1. Go to **API Keys** in dashboard
2. Edit the key
3. Add allowed IPs/subnets to **Subnet Whitelist**
4. Save changes

### Key Rotation

Regularly rotate API keys:

| Environment | Rotation Frequency |
|-------------|-------------------|
| Development | Monthly |
| Production | Quarterly |
| After incident | Immediately |

**Rotation process:**

1. Create new key with same permissions
2. Update applications to use new key
3. Verify new key works in production
4. Disable old key
5. Delete old key after grace period

## Secure Architecture

### Backend Proxy Pattern

Never call the API directly from client applications:

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│  Client  │────▶│ Your Backend │────▶│ Apertis API │
│ (no key) │     │  (has key)   │     │             │
└──────────┘     └──────────────┘     └─────────────┘
```

**Example proxy implementation (Node.js/Express):**

```javascript
import express from 'express';
import OpenAI from 'openai';

const app = express();
const client = new OpenAI({
  apiKey: process.env.APERTIS_API_KEY,
  baseURL: 'https://api.apertis.ai/v1'
});

app.post('/api/chat', async (req, res) => {
  // Validate and sanitize user input
  const { message } = req.body;

  if (!message || message.length > 10000) {
    return res.status(400).json({ error: 'Invalid message' });
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: message }]
    });

    res.json({ reply: response.choices[0].message.content });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Rate Limiting Your Backend

Protect your backend from abuse:

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute per IP
  message: { error: 'Too many requests' }
});

app.use('/api/', limiter);
```

### Request Validation

Always validate user input before sending to the API:

```python
from pydantic import BaseModel, validator

class ChatRequest(BaseModel):
    message: str
    model: str = "gpt-4o"

    @validator('message')
    def validate_message(cls, v):
        if len(v) > 10000:
            raise ValueError('Message too long')
        if len(v) < 1:
            raise ValueError('Message required')
        return v.strip()

    @validator('model')
    def validate_model(cls, v):
        allowed_models = ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet-20241022']
        if v not in allowed_models:
            raise ValueError(f'Model must be one of {allowed_models}')
        return v
```

## Data Protection

### Sensitive Data Handling

Never send sensitive data to the API unnecessarily:

```python
# ❌ WRONG - Sending real PII
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{
        "role": "user",
        "content": f"Summarize this customer record: {customer_data}"
        # Contains: SSN, credit card, address, etc.
    }]
)

# ✅ CORRECT - Anonymize or use placeholders
anonymized_data = anonymize(customer_data)
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{
        "role": "user",
        "content": f"Summarize this record: {anonymized_data}"
    }]
)
```

### Data Anonymization

Remove or mask PII before sending:

```python
import re

def anonymize_text(text):
    # Mask email addresses
    text = re.sub(r'[\w\.-]+@[\w\.-]+', '[EMAIL]', text)

    # Mask phone numbers
    text = re.sub(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '[PHONE]', text)

    # Mask credit card numbers
    text = re.sub(r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b', '[CARD]', text)

    # Mask SSN
    text = re.sub(r'\b\d{3}[-]?\d{2}[-]?\d{4}\b', '[SSN]', text)

    return text
```

### Logging Best Practices

Be careful what you log:

```python
import logging

logger = logging.getLogger(__name__)

# ❌ WRONG - Logging sensitive data
logger.info(f"Request: {full_request}")  # May contain API key or PII

# ✅ CORRECT - Log safely
logger.info(f"Request to model {model}, tokens: {token_count}")
```

## Authentication Security

### Session Management

For applications with user accounts:

```python
# Use secure session settings
app.config.update(
    SESSION_COOKIE_SECURE=True,      # HTTPS only
    SESSION_COOKIE_HTTPONLY=True,    # No JavaScript access
    SESSION_COOKIE_SAMESITE='Lax',   # CSRF protection
    PERMANENT_SESSION_LIFETIME=3600  # 1 hour expiry
)
```

### Multi-Factor Authentication

Enable 2FA on your Apertis account:

1. Go to **Account Settings**
2. Enable **Two-Factor Authentication**
3. Use an authenticator app (Google Authenticator, Authy)
4. Save backup codes securely

## Network Security

### HTTPS Only

Always use HTTPS for API calls:

```python
# ✅ CORRECT - HTTPS
base_url = "https://api.apertis.ai/v1"

# ❌ WRONG - HTTP (insecure)
base_url = "http://api.apertis.ai/v1"
```

### Certificate Validation

Never disable SSL certificate validation:

```python
# ❌ DANGEROUS - Never do this in production
client = OpenAI(
    api_key="sk-xxx",
    base_url="https://api.apertis.ai/v1",
    http_client=httpx.Client(verify=False)  # INSECURE!
)

# ✅ CORRECT - Use proper certificates
client = OpenAI(
    api_key="sk-xxx",
    base_url="https://api.apertis.ai/v1"
)
```

### Firewall Configuration

Restrict outbound connections:

```
# Allow only necessary outbound
ALLOW outbound to api.apertis.ai:443
DENY outbound to all other
```

## Monitoring & Alerting

### Usage Monitoring

Monitor for unusual patterns:

| Alert Condition | Possible Issue |
|-----------------|----------------|
| Sudden spike in usage | Key compromised or bug |
| Requests from new IPs | Unauthorized access |
| High error rates | Abuse or misconfiguration |
| After-hours activity | Unauthorized use |

### Security Logging

Log security-relevant events:

```python
import logging

security_logger = logging.getLogger('security')

def log_api_call(user_id, model, status):
    security_logger.info({
        'event': 'api_call',
        'user_id': user_id,
        'model': model,
        'status': status,
        'timestamp': datetime.utcnow().isoformat(),
        'ip': request.remote_addr
    })
```

### Incident Response

If you suspect a security breach:

1. **Immediately revoke** affected API keys
2. **Review logs** for unauthorized access
3. **Create new keys** with updated permissions
4. **Update applications** with new keys
5. **Investigate** the root cause
6. **Document** the incident and response
7. **Implement** preventive measures

## Compliance Considerations

### Data Residency

Be aware of where data is processed:

- API requests may be processed in various regions
- Consider compliance requirements (GDPR, HIPAA, etc.)
- Contact support for specific data residency needs

### Audit Trails

Maintain audit logs for compliance:

```python
def audit_log(action, user, details):
    log_entry = {
        'timestamp': datetime.utcnow().isoformat(),
        'action': action,
        'user': user,
        'details': details,
        'ip_address': get_client_ip()
    }
    # Store in audit database
    audit_db.insert(log_entry)
```

### Data Retention

Define clear data retention policies:

| Data Type | Retention | Reason |
|-----------|-----------|--------|
| API logs | 90 days | Debugging |
| Audit logs | 1 year | Compliance |
| User data | As needed | Business |

## Security Checklist

### Before Going Live

- [ ] API keys stored in environment variables
- [ ] Keys not committed to version control
- [ ] Backend proxy implemented (no client-side API calls)
- [ ] IP whitelisting configured
- [ ] Model restrictions set
- [ ] Rate limiting implemented
- [ ] Input validation in place
- [ ] Error handling doesn't expose sensitive info
- [ ] HTTPS enforced
- [ ] Logging configured (without sensitive data)

### Regular Review

- [ ] Rotate API keys quarterly
- [ ] Review access logs monthly
- [ ] Audit API key permissions
- [ ] Update dependencies for security patches
- [ ] Test incident response procedures
- [ ] Review and update security policies

## Related Topics

- [API Keys](../authentication/api-keys) - Key management
- [Rate Limits](../billing/rate-limits) - Request limits
- [Error Codes](../help/error-codes) - Error handling
- [Troubleshooting](../help/troubleshooting) - Common issues
