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

> **Note**
>
> When PAYG fallback activates, the **entire request** is billed using PAYG per-token pricing. There is no partial split between subscription quota and PAYG — it's one or the other.

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

**When this version applies.** This version of the Refund Policy applies to new manual purchases made from October 12, 2026, when it is shown to you before you pay. Automatic subscription renewals and automatic credit top-ups remain under the earlier version; they are covered by this version only after a separate email notice at least 30 days in advance.

The full Refund Policy is at [https://apertis.ai/refund](https://apertis.ai/refund). The section numbers below refer to it.

### Refund Policy

**Which transactions this version covers** (Refund Policy, Section 1):

- New purchases made after this version is published and shown to you before you pay.
- Automatic subscription renewals and automatic credit top-ups charged after you have been notified of this version at least 30 days in advance, or any longer period required by law or by your agreement with us.
- Purchases made earlier, quotes you accepted, payments already in progress and rights you already obtained continue to be governed by the version that applied to them.
- Where it is unclear which version applies to a transaction, we review the request instead of applying this version by default.

**General rule** (Section 2). Payments for the following are non-refundable, including when the credits or quota they provide have not been used:

- API credit top-ups, whether purchased manually or by automatic top-up.
- Subscription payments: initial purchases, renewals and upgrades.
- On-demand or additional usage charges.

Changing your mind, an accidental or impulse purchase, forgetting to cancel, or general dissatisfaction is not, by itself, a ground for a refund. This policy does not offer a general refund window, such as a number of days after payment within which any purchase may be refunded.

**When you may still request a refund** (Section 3). You may request a refund, and we will review the request, where:

- Applicable law gives you a right to a refund or to withdraw from the purchase (see Section 4).
- A written agreement with us provides for a refund.
- An earlier version of this policy applies to the transaction and provides for a refund.
- You were charged twice for the same purchase, or charged an amount different from the one shown to you, and we verify the error.
- A payment was made without the account holder's authorization. Usage made with an API key that was leaked or compromised remains the account holder's responsibility under the Terms of Service, but a payment you did not authorize is reviewed under this section.
- A material failure of Apertis systems prevented you from accessing or using the service you paid for, and we verify it (see Section 7).
- We end your access to prepaid service that has not yet been delivered, for a reason other than your breach of the Terms of Service.

A request is not an approval. Dissatisfaction with outputs the service produced as described is not a service failure. A service that was not provided, or that was materially different from its description, is not treated as a change of mind.

**Consumer rights under local law** (Section 4):

- Mandatory consumer protection law that cannot be waived by contract prevails over this policy.
- Depending on the product, whether you buy as a consumer or as a business, the law that applies, and any consent or information the law requires, such rights may include withdrawal or cooling-off periods and refund rules, for example in the European Economic Area, the United Kingdom, Turkey, South Korea and Taiwan.
- These examples do not state which law applies to a particular transaction. We do not decide this from your IP address or card country alone; where applicability is unclear, we review the request.
- Where the law requires a full refund, we do not deduct usage or elapsed time. Where the law allows a deduction, we deduct only what the law allows.
- A request is not refused only because a period mentioned in an example has passed; it is reviewed against the law that applies.
- Rights that the law gives only to consumers may not apply to purchases made for a business. A written agreement with a business customer takes precedence over this policy, subject to mandatory law.

**Service interruptions** (Section 7):

- This version does not provide a fixed service extension or multiple of an interruption period.
- For a verified incident, remedies follow applicable law and any written service level or other agreement with you. A material failure may also be a ground for a refund under Section 3.
- Obligations that arose under an earlier version of this policy, for the transactions or incidents it covers, are kept.
- Where the law gives you a cash remedy, we do not require you to accept credit instead.

**How approved refunds are paid** (Section 9):

- Approved refunds are returned to the original payment method.
- A refund is limited to the cash actually paid for the transaction, less any amount already refunded for it. Credits, bonuses and account credit are not converted to cash.
- When the money reaches you depends on your payment provider. As a guide: credit cards 7–14 business days after the refund is issued; electronic payments such as Apple Pay or Google Pay 7–14 business days; other payment methods up to 30 business days. A refund we have issued has not necessarily reached your account yet.

### Requesting a Refund

Email hi@apertis.ai with:

1. The email address of your Apertis account.
2. The transaction: an invoice or receipt number, or the date and amount of the charge.
3. The reason for the request and any information that supports it.

Never send a full card number or card security code (CVC). We will not ask for them.

- We record the time we receive your request. That time, not the time we finish reviewing it, is the one that counts for any deadline.
- We aim to send an initial response within 3 business days. This is a response target; it does not shorten or extend any right or deadline you have.

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
