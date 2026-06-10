# API Keys

API keys are used to authenticate requests to the Apertis API. This guide explains how to obtain, manage, and secure your API keys.

## Obtaining Your API Key

### Standard API Key (PAYG)

1. **Sign up or log in** to your account at [Apertis](https://apertis.ai/login)
2. Navigate to [**API Keys**](https://apertis.ai/token)
3. Click **Create New Key** to generate a new API key
4. Copy and securely store your API key - it will only be shown once

### Subscription API Key

If you have an active subscription, a dedicated API key is automatically created for you:

1. Click **My Plan** in the navbar (or go to [**Settings**](https://apertis.ai/setting?tab=apikeys))
2. Switch to the **API Keys** tab
3. Your subscription key (`sk-sub-...`) is listed with integration guides and ready to use

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

| Method       | Header          | Example                                 |
| ------------ | --------------- | --------------------------------------- |
| Bearer Token | `Authorization` | `Authorization: Bearer sk-your-api-key` |
| API Key      | `x-api-key`     | `x-api-key: sk-your-api-key`            |

Both methods work across all endpoints. The `x-api-key` header provides compatibility with Anthropic SDKs.

### Example: Bearer Token (OpenAI SDKs)

```bash
curl https://api.apertis.ai/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5.5",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Example: x-api-key (Anthropic SDKs)

```bash
curl https://api.apertis.ai/v1/messages \
  -H "x-api-key: sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-6",
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
    model="gpt-5.5",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)
```

### Node.js Example

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "sk-your-api-key",
  baseURL: "https://api.apertis.ai/v1",
});

const response = await client.chat.completions.create({
  model: "gpt-5.5",
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(response.choices[0].message.content);
```

## API Key Settings

### Quota Management

Each API key has its own quota allocation:

| Setting             | Description                     |
| ------------------- | ------------------------------- |
| **Remaining Quota** | Available balance for API calls |
| **Used Quota**      | Total amount consumed           |
| **Unlimited**       | Option to set unlimited quota   |

### Model Restrictions

You can restrict which models an API key can access:

- **All Models**: Access to all available models (default)
- **Specific Models**: Whitelist only certain models

Example: Restrict a key to only use `gpt-5.5` and `claude-sonnet-4-6`:

```
Model Whitelist: gpt-5.5, claude-sonnet-4-6
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

### Organization API Keys (`sk-org_`)

- Created from an organization, usually scoped to a project
- Bill to the organization instead of only the individual user
- Can use permission modes such as **All**, **Restricted**, or **Read only**
- Are disabled when their owning member is removed from the organization

Organization keys have two views:

| View                 | Use                                                            |
| -------------------- | -------------------------------------------------------------- |
| **Project API Keys** | Keys scoped to organization projects and shared team workloads |
| **User API Keys**    | Keys tied to individual members for organization usage         |

### Organization API Keys Tab Rules

The organization **API Keys** tab separates shared project keys from member-owned user keys so billing, audit logs, and access control stay clear.

#### Project keys

Project keys are owned by the organization project, not by an individual member. Use project keys for shared workloads such as production backends, staging services, CI jobs, server-side integrations, or applications maintained by a team.

Project key behavior:

- Owners and members with API key management permission can create project keys.
- Project keys bill to the organization.
- Project keys can be restricted to a project and permission mode, such as **All**, **Restricted**, or **Read only**.
- The **Created by** column records who created the key, but the key remains project-owned.
- Disabling or deleting a project key immediately stops requests that use it.
- Project keys are the preferred choice for long-running services because they do not depend on one member's personal key lifecycle.

Use a project key when:

- A service is shared by multiple people.
- The key is deployed to backend infrastructure.
- Usage should continue even if the original creator changes teams.
- You need organization-level billing and audit visibility.

#### User keys

User keys are owned by individual organization members. Use user keys for personal development, CLI usage, local testing, notebooks, or workflows where the audit trail should point directly to one member.

User key behavior:

- A user key must be created by the member who owns it.
- Organization owners cannot create user-owned secrets on behalf of another member.
- The key's effective access follows the member's organization, project, group, and role permissions.
- If the member is removed from the organization, the member's organization-scoped user keys are disabled for that organization.
- Requests made with a user key are attributed to that user in audit and usage review.

Use a user key when:

- One person is experimenting or developing locally.
- The key should stop working when that person's access is removed.
- You need user-level attribution instead of a shared service identity.

:::tip
If an owner needs a key for a shared service, create a **Project API Key**. If a member needs a personal development key, that member should create a **User API Key** from their own account context.
:::

For organization access rules, see [Organizations, Members, Groups, and Roles](./organizations.md).

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

| Use Case                | Recommended Settings                        |
| ----------------------- | ------------------------------------------- |
| Development             | Low quota, all models, no IP restriction    |
| Production              | Higher quota, specific models, IP whitelist |
| Testing                 | Limited quota, expiration date set          |
| Third-party Integration | Minimal quota, specific models only         |

## Revoking API Keys

To revoke an API key:

1. Go to **API Keys** in your dashboard
2. Find the key you want to revoke
3. Click **Delete** or **Disable**

:::caution
Revoking a key is immediate and cannot be undone. Any applications using that key will stop working immediately.
:::

Organization API key rows also provide quick actions:

| Action               | Use                                                    |
| -------------------- | ------------------------------------------------------ |
| **Recent Activity**  | Review the selected key's last known activity metadata |
| **Edit**             | Rename the key or change permission mode               |
| **Open in Chat**     | Open Apertis Chat from the key row                     |
| **Disable / Enable** | Temporarily disable or re-enable a key                 |
| **Delete**           | Revoke the key so requests using it are rejected       |

## Troubleshooting

### Common Issues

| Error                   | Cause                            | Solution                                    |
| ----------------------- | -------------------------------- | ------------------------------------------- |
| `401 Unauthorized`      | Invalid or missing API key       | Check key is correct and included in header |
| `403 Forbidden`         | Key doesn't have access to model | Check model restrictions on your key        |
| `429 Too Many Requests` | Rate limit exceeded              | Reduce request frequency or upgrade plan    |
| `402 Payment Required`  | Quota exhausted                  | Add more quota or enable PAYG fallback      |

## Related Topics

- [Subscription Plans](../billing/subscription-plans) - Learn about quota and billing
- [Rate Limits](../billing/rate-limits) - Understand request limits
- [Error Codes](../help/error-codes) - Complete error reference
