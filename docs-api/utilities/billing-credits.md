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
    "remaining_usd": 5.0,
    "used_usd": 2.0,
    "total_usd": 7.0,
    "is_unlimited": false
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
    "remaining_usd": 0.95,
    "used_usd": 0.05,
    "total_usd": 1.0,
    "is_unlimited": false
  },
  "subscription": {
    "plan_type": "lite",
    "status": "active",
    "cycle_quota_limit": 600,
    "cycle_quota_used": 3,
    "cycle_quota_remaining": 597,
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
    "remaining_usd": 3.0,
    "used_usd": 0.5,
    "total_usd": 3.5,
    "is_unlimited": false
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

#### `payg` Object

| Field | Type | Description |
|-------|------|-------------|
| `remaining_usd` | number \| null | Remaining credits in USD. `null` when `is_unlimited` is true |
| `used_usd` | number | Total credits consumed in USD |
| `total_usd` | number \| null | Total credits (remaining + used) in USD. `null` when unlimited |
| `is_unlimited` | boolean | Whether the API key has unlimited quota |
| `monthly_limit_usd` | number | Monthly spending limit in USD (only present if configured) |
| `monthly_used_usd` | number | Spending in current month in USD (only present if limit configured) |
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

### Token-Level vs User-Level

When using an API key, the `payg` section shows the **specific token's** quota balance by default. All tokens belonging to the same account will see the same `subscription` data.

### Python Example

```python
import requests

response = requests.get(
    "https://api.apertis.ai/v1/dashboard/billing/credits",
    headers={"Authorization": "Bearer sk-your-api-key"}
)
credits = response.json()

if credits["is_subscriber"]:
    sub = credits["subscription"]
    print(f"Plan: {sub['plan_type']}")
    print(f"Quota: {sub['cycle_quota_used']}/{sub['cycle_quota_limit']} used")
    print(f"Remaining: {sub['cycle_quota_remaining']}")
else:
    payg = credits["payg"]
    print(f"Balance: ${payg['remaining_usd']:.2f} USD")
```

### Node.js Example

```javascript
const response = await fetch(
  'https://api.apertis.ai/v1/dashboard/billing/credits',
  { headers: { Authorization: 'Bearer sk-your-api-key' } }
);
const credits = await response.json();

if (credits.is_subscriber) {
  const { plan_type, cycle_quota_used, cycle_quota_limit } = credits.subscription;
  console.log(`${plan_type}: ${cycle_quota_used}/${cycle_quota_limit} quota used`);
} else {
  console.log(`Balance: $${credits.payg.remaining_usd.toFixed(2)}`);
}
```
