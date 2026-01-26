# Subscription Plans

Apertis offers flexible subscription plans designed to meet different usage needs. Choose the plan that best fits your requirements.

## Available Plans

### Plan Comparison

| Feature | Lite | Pro | Max |
|---------|------|-----|-----|
| Monthly Quota | Basic | Standard | Premium |
| Model Access | All models | All models | All models |
| Priority Support | - | Email | Priority |
| PAYG Fallback | Optional | Optional | Optional |
| Billing Cycles | Monthly, Quarterly, Yearly | Monthly, Quarterly, Yearly | Monthly, Quarterly, Yearly |

### Billing Cycles

All plans are available with three billing cycle options:

| Cycle | Discount | Best For |
|-------|----------|----------|
| **Monthly** | Standard price | Flexibility, testing |
| **Quarterly** | ~10% savings | Regular usage |
| **Yearly** | ~20% savings | Long-term commitment |

## Quota System

### How Quota Works

Each subscription includes a monthly quota that resets at the start of each billing cycle:

```
Cycle Start → Use Quota → Cycle End → Quota Reset
     ↓                         ↓
  Full Quota              New Cycle Begins
```

### Quota Calculation

Quota is calculated based on token usage with model-specific multipliers:

```
Quota Used = Prompt Tokens + (Completion Tokens × Completion Multiplier)
```

## PAYG (Pay-As-You-Go) Fallback

### What is PAYG Fallback?

When your subscription quota is exhausted, PAYG fallback allows you to continue using the API by charging to your account balance:

```
Subscription Quota Exhausted → PAYG Kicks In → Continue Using API
```

### Configuring PAYG

| Setting | Description |
|---------|-------------|
| **Enable/Disable** | Toggle PAYG fallback on or off |
| **Spending Limit** | Maximum PAYG spending per cycle |
| **Current Spent** | PAYG amount used this cycle |

### PAYG Spending Limits

Set a spending limit to control costs:

```
Example: Spending Limit = $50/month

If subscription quota runs out:
- PAYG activates
- Maximum $50 additional spending allowed
- After $50, requests will be rejected until next cycle
```

## Subscription Lifecycle

### Subscription Status

| Status | Description |
|--------|-------------|
| **Active** | Subscription is current and usable |
| **Suspended** | Temporarily paused (payment issue or manual) |
| **Cancelled** | Will end at period end |
| **Expired** | Subscription has ended |

### Cycle Reset

At the start of each billing cycle:

1. Quota is reset to your plan's limit
2. PAYG spending counter resets to zero
3. Usage history is preserved for reporting

### Payment Failure Handling

If a payment fails:

1. **Grace Period**: 3-7 days to resolve payment issue
2. **Suspension**: Subscription suspended if not resolved
3. **Recovery**: Automatic reactivation upon successful payment

## Managing Your Subscription

### Viewing Subscription Status

Access your subscription details in the dashboard:

- Current plan and billing cycle
- Quota usage (used / limit)
- Next billing date
- Payment history

### Changing Plans

You can upgrade or downgrade your plan at any time:

**Upgrading:**
- Takes effect immediately
- Quota is prorated for the remaining period
- Additional quota added instantly

**Downgrading:**
- Takes effect at next billing cycle
- Current quota remains until cycle ends

### Cancelling Subscription

To cancel your subscription:

1. Go to **Billing** → **Subscription**
2. Click **Cancel Subscription**
3. Choose cancellation timing:
   - **Immediate**: Ends now (no refund for remaining period)
   - **End of Period**: Continues until current cycle ends

:::note
After cancellation, your subscription API key will stop working at the end of the billing period.
:::

## Subscription vs. PAYG-Only

### When to Use Subscription

- **Predictable usage**: You know your monthly needs
- **Cost savings**: Subscriptions offer better rates than pure PAYG
- **Budget planning**: Fixed monthly costs
- **Consistent access**: No need to top up balance

### When to Use PAYG-Only

- **Variable usage**: Usage fluctuates significantly
- **Testing phase**: Evaluating the platform
- **Low volume**: Occasional API calls
- **No commitment**: Flexibility over savings

### Auto Top-up

Enable automatic balance top-up to ensure uninterrupted service:

| Setting | Description |
|---------|-------------|
| **Enable** | Turn on auto top-up |
| **Threshold** | Balance level that triggers top-up |
| **Amount** | Amount to add when triggered |
| **Payment Method** | Card to charge |

```
Example:
Threshold: $10
Amount: $50

When balance drops below $10 → Automatically charge $50 to your card
```

## Dedicated Subscription Token

Each subscription comes with a dedicated API token:

- **Format**: `sk-sub-xxxxxxxxxxxx`
- **Auto-sync**: Quota automatically synced with subscription
- **Cycle Reset**: Token quota resets with billing cycle
- **Separate from Regular Tokens**: Managed independently

### Using Your Subscription Token

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-sub-your-subscription-key",
    base_url="https://api.apertis.ai/v1"
)

# Quota is tracked against your subscription
response = client.chat.completions.create(
    model="gpt-4.1",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

## FAQ

### What happens when my quota runs out?

- **With PAYG enabled**: API continues working, charged to your balance
- **Without PAYG**: API returns `402 Payment Required` error

### Can I change my billing cycle?

Yes, you can switch between monthly, quarterly, and yearly at renewal time.

### Is there a free trial?

Contact support for trial options and promotional offers.

### Can I get a refund?

Refunds are handled on a case-by-case basis. Contact support for assistance.

## Related Topics

- [API Keys](../authentication/api-keys) - Manage your API keys
- [Rate Limits](./rate-limits) - Understand request limits
- [Troubleshooting](../help/troubleshooting) - Common issues and solutions
