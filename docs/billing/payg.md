# Pay-As-You-Go (PAYG)

Pay-As-You-Go allows you to use the Apertis API without a subscription by paying for what you use. This guide explains how PAYG works and how to manage it effectively.

## Overview

PAYG is a flexible billing model where you:

1. **Add funds** to your account balance
2. **Use the API** as needed
3. **Pay per usage** based on actual consumption

```
Add Funds → Make Requests → Deduct from Balance → Top Up When Low
```

## PAYG vs. Subscription

| Feature | PAYG | Subscription |
|---------|------|--------------|
| Commitment | None | Monthly/Yearly |
| Pricing | Standard rates | Discounted rates |
| Quota Reset | Never (balance-based) | Monthly cycle |
| Best For | Variable usage | Predictable usage |
| Minimum | $5 | Plan price |

### When to Use PAYG

- **Testing phase** - Evaluating the platform
- **Sporadic usage** - Occasional API calls
- **Unpredictable volume** - Usage varies significantly
- **Budget flexibility** - Pay only for what you use

### When to Use Subscription

- **Regular usage** - Consistent monthly volume
- **Cost savings** - Lower per-token rates
- **Budgeting** - Fixed monthly costs
- **High volume** - Heavy API usage

## Adding Funds

### Payment Methods

| Method | Availability | Processing |
|--------|--------------|------------|
| Credit/Debit Card | Global | Instant |

All payments are securely processed through **Stripe**.

### Top-Up Process

1. Log in to [Dashboard](https://apertis.ai/login)
2. Go to **Billing** → **Add Funds**
3. Select amount
4. Choose payment method
5. Complete payment

### Minimum Top-Up

| Method | Minimum |
|--------|---------|
| Credit Card | $5 |

## PAYG Pricing

PAYG uses standard pricing per token based on the model used. For current model pricing, please visit the [Models page](https://apertis.ai/models).

### Cost Calculation

```
Cost = (Input Tokens × Input Rate) + (Output Tokens × Output Rate)
```

## PAYG Fallback for Subscriptions

Subscription users can enable PAYG as a fallback when subscription quota is exhausted.

### How It Works

```
Request → Check Subscription Quota
              ↓
         Quota Available? → Yes → Use Subscription Quota
              ↓ No
         PAYG Enabled? → Yes → Use Account Balance
              ↓ No
         Return 402 Error
```

### Enabling PAYG Fallback

1. Go to **Billing** → **Subscription**
2. Find **PAYG Fallback** section
3. Toggle **Enable PAYG Fallback**
4. Set **Spending Limit** (optional)
5. Save changes

### Spending Limits

Set a maximum PAYG spending per billing cycle:

| Setting | Effect |
|---------|--------|
| No limit | Use balance until exhausted |
| $50/cycle | Max $50 PAYG per month |
| $0 | PAYG disabled (same as off) |

### Hybrid Billing

When a request spans both subscription quota and PAYG:

```
Example: 100 quota remaining, request needs 150

Subscription pays: 100 (remaining quota)
PAYG pays: 50 (overflow)
Total request: 150 ✓
```

## Auto Top-Up

Automatically add funds when balance drops below a threshold.

### Configuration

| Setting | Description |
|---------|-------------|
| **Enable** | Turn on auto top-up |
| **Threshold** | Balance level to trigger |
| **Amount** | Amount to add each time |
| **Payment Method** | Card to charge |

### Example Setup

```
Threshold: $10
Amount: $50

When balance drops below $10:
→ Automatically charge $50 to saved card
→ New balance: current + $50
```

### Setting Up Auto Top-Up

1. Go to **Billing** → **Payment Methods**
2. Add or select a payment method
3. Go to **Auto Top-Up** settings
4. Enable and configure threshold/amount
5. Save

### Best Practices

| Scenario | Threshold | Amount |
|----------|-----------|--------|
| Light usage | $5 | $20 |
| Regular usage | $20 | $50 |
| Heavy usage | $50 | $100 |
| Production | $100 | $200 |

## Monitoring PAYG Usage

### Dashboard Views

- **Balance Overview** - Current balance and recent transactions
- **Usage Graph** - Daily/weekly/monthly spending trends
- **Transaction History** - Detailed transaction log

### API Access

Check balance programmatically:

```python
import requests

response = requests.get(
    "https://api.apertis.ai/api/user/self",
    headers={"Authorization": "Bearer sk-your-api-key"}
)

user_info = response.json()
balance = user_info['data']['quota']
print(f"Current balance: ${balance / 500000:.2f}")  # Convert from internal units
```

## Low Balance Handling

### Warning Levels

| Balance | Status | Recommendation |
|---------|--------|----------------|
| > $20 | Normal | Continue usage |
| $10-20 | Low | Consider top-up |
| $5-10 | Warning | Top up soon |
| < $5 | Critical | Top up immediately |

### When Balance Exhausted

```json
{
  "error": {
    "message": "Insufficient account balance",
    "type": "billing_error",
    "code": "insufficient_balance"
  }
}
```

### Recovery Steps

1. **Immediate**: Add funds via dashboard
2. **Prevention**: Enable auto top-up
3. **Monitoring**: Set up low balance alerts

## PAYG for Teams

### Shared Balance

Team accounts share a common balance:

- All team members use the same balance
- Usage is tracked per API key
- Billing goes to account owner

### Per-Key Limits

Control spending per team member:

1. Create separate API keys for each member
2. Set quota limits on each key
3. Monitor usage per key

## Cost Optimization

### Model Selection

Choose cost-effective models for your use case:

| Use Case | Recommended | Cost |
|----------|-------------|------|
| Simple chat | GPT-3.5 Turbo | $ |
| General tasks | GPT-4o-mini | $ |
| Complex reasoning | GPT-4o | $$ |
| Long context | Claude Sonnet 4.5 | $$ |

### Prompt Optimization

Reduce costs by optimizing prompts:

```python
# Expensive: Long, verbose prompt
prompt = """
I would like you to help me with the following task.
Please read the text below carefully and provide
a detailed summary of the main points...
"""

# Cheaper: Concise prompt
prompt = "Summarize the key points:"
```

### Caching Strategy

Implement caching for repeated queries:

```python
import hashlib
from functools import lru_cache

@lru_cache(maxsize=1000)
def cached_completion(prompt_hash):
    # Only calls API if not cached
    return client.chat.completions.create(...)
```

### Set Max Tokens

Limit response length to control costs:

```python
response = client.chat.completions.create(
    model="gpt-4.1",
    messages=[...],
    max_tokens=500  # Limit output length
)
```

## Billing Statements

### Viewing Statements

1. Go to **Billing** → **Statements**
2. Select month
3. View or download PDF

### Statement Contents

- Beginning balance
- Top-ups during period
- Usage breakdown by model
- Ending balance
- Transaction details

## Refunds

### Refund Policy

- Unused balance is generally non-refundable
- Contact support for exceptional circumstances
- Refunds processed to original payment method

### Requesting a Refund

1. Contact support at hi@apertis.ai
2. Provide account email and reason
3. Allow 5-7 business days for review

## FAQ

### Can I switch from PAYG to subscription?

Yes, you can subscribe at any time. Your PAYG balance remains available for fallback usage.

### What happens to unused PAYG balance?

Balance never expires and remains available until used.

### Can I get invoices for PAYG purchases?

Yes, invoices are available in the Billing section for all top-ups.

### Is there a minimum balance required?

No minimum balance is required, but we recommend maintaining at least $5 for uninterrupted service.

## Related Topics

- [Subscription Plans](./subscription-plans) - Compare with subscriptions
- [Quota Management](./quota-management) - Understanding quota
- [Rate Limits](./rate-limits) - Request limits
- [API Keys](../authentication/api-keys) - Key management
