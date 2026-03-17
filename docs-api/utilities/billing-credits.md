# Billing Credits

```json
/v1/dashboard/billing/credits
```

## Check remaining credits

Returns your current billing balance, including PAYG credits (in USD) and subscription cycle quota. Authenticate with any API key — no admin key required.

:::tip Apertis Exclusive
Neither OpenAI nor Anthropic offer a programmatic endpoint for checking remaining credits. This is an Apertis-only feature.
:::

### HTTP Request

```bash
curl https://api.apertis.ai/v1/dashboard/billing/credits \
    -H "Authorization: Bearer <APERTIS_API_KEY>"
```

- `<APERTIS_API_KEY>`: Any valid API key (`sk-` or `sk-sub-`)

### Response (PAYG Only)

When using a standard API key with no active subscription:

```json
{
  "object": "billing_credits",
  "is_subscriber": false,
  "payg": {
    "account_credits": 5.0,
    "token_used": 2.0,
    "token_total": 7.0,
    "token_remaining": 5.0,
    "token_is_unlimited": false
  }
}
```

### Response (PAYG with Unlimited Token)

When the API key has unlimited quota, token-level fields show `"unlimited"` while `account_credits` still reflects the actual account balance:

```json
{
  "object": "billing_credits",
  "is_subscriber": false,
  "payg": {
    "account_credits": 500.0,
    "token_used": 87.61,
    "token_total": "unlimited",
    "token_remaining": "unlimited",
    "token_is_unlimited": true
  }
}
```

### Response (Subscription)

When the account has an active subscription plan:

```json
{
  "object": "billing_credits",
  "is_subscriber": true,
  "payg": {
    "account_credits": 9.98,
    "token_used": 0.05,
    "token_total": 1.0,
    "token_remaining": 0.95,
    "token_is_unlimited": false
  },
  "subscription": {
    "plan_type": "lite",
    "status": "active",
    "cycle_quota_limit": 600,
    "cycle_quota_used": 10,
    "cycle_quota_remaining": 590,
    "cycle_start": "2026-03-16T10:02:35Z",
    "cycle_end": "2026-04-16T10:02:35Z",
    "payg_fallback_enabled": false
  }
}
```

### Response (Subscription with PAYG Fallback)

When the subscription has PAYG overage enabled:

```json
{
  "object": "billing_credits",
  "is_subscriber": true,
  "payg": {
    "account_credits": 3.0,
    "token_used": 0.5,
    "token_total": 3.5,
    "token_remaining": 3.0,
    "token_is_unlimited": false
  },
  "subscription": {
    "plan_type": "max",
    "status": "active",
    "cycle_quota_limit": 5000,
    "cycle_quota_used": 5000,
    "cycle_quota_remaining": 0,
    "cycle_start": "2026-03-01T00:00:00Z",
    "cycle_end": "2026-04-01T00:00:00Z",
    "payg_fallback_enabled": true,
    "payg_spent_usd": 2.5,
    "payg_limit_usd": 10.0
  }
}
```

### Response Fields

#### Top Level

| Field | Type | Description |
|-------|------|-------------|
| `object` | string | Always `"billing_credits"` |
| `is_subscriber` | boolean | Whether the account has an active subscription |
| `payg` | object | PAYG credit balance (always present) |
| `subscription` | object | Subscription quota details (only present when subscribed) |

#### `payg` Object — Account Level

| Field | Type | Description |
|-------|------|-------------|
| `account_credits` | number | Remaining credits for the entire account in USD |

#### `payg` Object — Token Level

| Field | Type | Description |
|-------|------|-------------|
| `token_used` | number | Credits consumed by this token in USD |
| `token_total` | number \| `"unlimited"` | Total credits allocated to this token (remaining + used). `"unlimited"` when token has no quota limit |
| `token_remaining` | number \| `"unlimited"` | Remaining credits for this token in USD. `"unlimited"` when token has no quota limit |
| `token_is_unlimited` | boolean | Whether this token has unlimited quota |
| `token_monthly_limit_usd` | number | Monthly spending limit for this token in USD (only present if configured) |
| `token_monthly_used_usd` | number | Spending by this token in current month in USD (only present if limit configured) |
| `monthly_reset_day` | integer | Day of month when the monthly counter resets (only present if limit configured) |

#### `subscription` Object

| Field | Type | Description |
|-------|------|-------------|
| `plan_type` | string | Plan name: `lite`, `pro`, or `max` |
| `status` | string | Subscription status: `active`, `suspended`, or `cancelled` |
| `cycle_quota_limit` | integer | Total quota allocation for the current billing cycle |
| `cycle_quota_used` | integer | Quota consumed in the current cycle |
| `cycle_quota_remaining` | integer | Remaining quota in the current cycle |
| `cycle_start` | string | Current cycle start date (ISO 8601) |
| `cycle_end` | string | Current cycle end date (ISO 8601) |
| `payg_fallback_enabled` | boolean | Whether PAYG overage billing is enabled when cycle quota is exhausted |
| `payg_spent_usd` | number | PAYG overage spent this cycle in USD (only present when fallback enabled) |
| `payg_limit_usd` | number | PAYG overage spending limit in USD (only present when fallback enabled and limit set) |

### Token-Level vs Account-Level

The `payg` section separates **account-level** and **token-level** information:

- **`account_credits`**: The total remaining balance for the user account, shared across all tokens.
- **`token_*` fields**: Quota specific to the API key used in the request. Each token can have its own quota allocation and limits.

When a token is set to unlimited (`token_is_unlimited: true`), `token_remaining` and `token_total` return `"unlimited"` since the token itself has no cap — but `account_credits` still shows the real account balance.

### Python Example

```python
import requests

response = requests.get(
    "https://api.apertis.ai/v1/dashboard/billing/credits",
    headers={"Authorization": "Bearer sk-your-api-key"}
)
credits = response.json()

payg = credits["payg"]
print(f"Account Balance: ${payg['account_credits']:.2f} USD")

if payg["token_is_unlimited"]:
    print("Token: unlimited")
else:
    print(f"Token: ${payg['token_remaining']:.2f} / ${payg['token_total']:.2f} USD")

if credits["is_subscriber"]:
    sub = credits["subscription"]
    print(f"Plan: {sub['plan_type']}")
    print(f"Quota: {sub['cycle_quota_used']}/{sub['cycle_quota_limit']} used")
```

### Node.js Example

```javascript
const response = await fetch(
  'https://api.apertis.ai/v1/dashboard/billing/credits',
  { headers: { Authorization: 'Bearer sk-your-api-key' } }
);
const credits = await response.json();

const { payg } = credits;
console.log(`Account: $${payg.account_credits.toFixed(2)}`);

if (payg.token_is_unlimited) {
  console.log('Token: unlimited');
} else {
  console.log(`Token: $${payg.token_remaining.toFixed(2)} / $${payg.token_total.toFixed(2)}`);
}

if (credits.is_subscriber) {
  const { plan_type, cycle_quota_used, cycle_quota_limit } = credits.subscription;
  console.log(`${plan_type}: ${cycle_quota_used}/${cycle_quota_limit} quota used`);
}
```
