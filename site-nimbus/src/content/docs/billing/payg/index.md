---
title: "Pay-As-You-Go (PAYG)"
---

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
         Quota Available? → Yes → Deduct Model Rate from Quota (per-request)
              ↓ No
         PAYG Enabled? → Yes → Charge Entire Request per Token (from balance)
              ↓ No
         Return 402 Error
```

<aside class="admonition admonition-note">
<p class="admonition-title">Note</p>

When PAYG fallback activates, the **entire request** is billed using PAYG per-token pricing. There is no partial split between subscription quota and PAYG — it's one or the other.

</aside>

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

### Billing Mode Switch

Subscription and PAYG use different billing models:

| Billing Mode | How It Charges |
|-------------|----------------|
| **Subscription** | Fixed quota per request (model rate × 1) |
| **PAYG** | Per token (input tokens × input rate + output tokens × output rate) |

When your subscription quota runs out and PAYG is enabled, the next request is charged entirely through PAYG per-token pricing. There is no partial split between the two billing modes.

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
    "https://api.apertis.ai/v1/dashboard/billing/credits",
    headers={"Authorization": "Bearer sk-your-api-key"}
)

credits = response.json()
balance = credits["payg"]["account_credits"]
print(f"Current balance: ${balance:.2f} USD")
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
| Simple chat | GPT-5.4 nano | $ |
| General tasks | GPT-5.4 mini | $ |
| Complex reasoning | GPT-5.5 | $$ |
| Long context | Claude Sonnet 4.6 | $$ |

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
    model="gpt-5.5",
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

**TODO(refund-policy-v2):** pending the reviewed legal source (Refund Policy link, version, hash and effective date); the regional summary below must match it. Do not publish while this line is present.

### Refund Policy

Top-ups are non-refundable once paid, including any balance you have not used. This covers manual top-ups and Auto Top-Up charges, including balance used for PAYG fallback on a subscription. There is no general refund window: a mistaken or unwanted purchase, an unused balance or a change of mind does not by itself qualify for a refund.

We review a refund request when one of these applies:

- The law that applies to your purchase gives you a right to cancel or to a refund.
- A written contract between you and Apertis provides for a refund.
- The purchase was made under an earlier version of the Refund Policy that still applies to it.
- We verify a duplicate charge, a charge for the wrong amount, or a charge you did not authorize.
- We verify a significant failure of the Apertis service, or of your access to it, that prevented you from using what you paid for.
- Apertis ended your service for a reason other than your breach of the terms, and prepaid service was left undelivered.

Sending a request does not mean it is approved. Approved refunds are paid to the original payment method, up to the amount you actually paid that has not already been refunded. Promotional, bonus and account credits are not paid out in cash. Adjustments the API makes to your balance for individual requests are not refunds, and this policy does not change them.

**Regional rights.** Consumer law where you live may give you rights that this policy cannot remove, for example the 14-day right of withdrawal for consumers in the EEA and the UK, the corresponding rules in Turkey, Korea's rules (a full refund of an unused purchase within 7 days, and otherwise a refund in proportion to the remaining period), and the rules of Taiwan or another jurisdiction where they give you more. Whether a right applies depends on what you bought, whether you bought it as a consumer or for a business, and the law that governs the purchase, not only on your IP address or card country. These examples are not a complete list. If you are not sure, send your request and we will review it.

**Service incidents.** The remedy for a service incident depends on what we verify, applicable law and any written SLA or contract. There is no fixed service-extension rate. Commitments already made for earlier purchases or incidents still apply.

**Which version applies.** This policy applies to purchases made after it is published. For Auto Top-Up charges and automatic subscription renewals, it applies only after at least 30 days' notice. Earlier purchases keep the refund terms that applied when you made them.

### Requesting a Refund

1. Email hi@apertis.ai from your account email address
2. Include the transaction date and amount (or the invoice number), and which exception you believe applies
3. Do not send your full card number or card security code (CVC)

We aim to send a first response within 3 business days. Your request counts from the time we receive it, and this target does not shorten or extend any deadline the law gives you. If a refund is approved, how long it takes to reach you depends on your payment method and bank.

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

- [Subscription Plans](/billing/subscription-plans) - Compare with subscriptions
- [Quota Management](/billing/quota-management) - Understanding quota
- [Rate Limits](/billing/rate-limits) - Request limits
- [API Keys](/authentication/api-keys) - Key management
