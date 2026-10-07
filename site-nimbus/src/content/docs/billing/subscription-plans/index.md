---
title: "Subscription Plans"
---

# Subscription Plans

Apertis offers flexible subscription plans designed to meet different usage needs. Choose the plan that best fits your requirements.

## Available Plans

### Plan Comparison

| Feature | Lite | Pro | Max |
|---------|------|-----|-----|
| Monthly Quota | Basic | Standard | Premium |
| Model Access | Lite + Free models | Pro + Lite + Free models | All models |
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

### How Billing Works

Every API request consumes a **fixed amount of quota** based on the model's **multiplier rate** — regardless of how many tokens you use:

```
Quota Consumed per Request = Model Rate (fixed multiplier)
```

Each request deducts the model's rate from your monthly allowance — whether the response is 10 tokens or 10,000 tokens. Higher-tier plans offer lower rates, giving you more usage per quota.

<aside class="admonition admonition-tip">
<p class="admonition-title">Tip</p>

This is different from PAYG (Pay-As-You-Go), which charges per token. Subscription billing is simpler: one request = one fixed quota deduction.

</aside>

### Free Models

Every plan includes a selection of models that consume **no quota** — typically fast, lightweight models suited to high-volume or everyday tasks. Because this lineup changes over time, we don't list specific models here. See the [Subscribe page](https://apertis.ai/subscribe) for the models currently available free on your plan.

### Model Rates by Plan

Each model has a different rate depending on your plan. Higher-tier plans offer lower rates, giving you more usage per quota. For the full model list and up-to-date rates, see the [Subscribe page](https://apertis.ai/subscribe).

You can also query the current rates programmatically using the [Models API](/api/utilities/models) with your subscription key — the response includes a `multiplier` field for each model.

<aside class="admonition admonition-tip">
<p class="admonition-title">Coding Tools</p>

When using coding tools such as Claude Code, Roo Code, Cline, Kilo Code, OpenCode, Crush, or Goose, add the `code:` prefix to Claude model IDs (e.g., `code:claude-opus-4-8`). This routes requests through optimized coding channels. The same subscription quota and rates apply. See the [Claude Code guide](/installation/claude-code#coding-model-ids) for details.

</aside>

### Estimated Uses per Month

You can estimate how many requests you get per month by dividing your plan's quota by the model rate:

```
Estimated Uses = Monthly Quota ÷ Model Rate
```

<aside class="admonition admonition-note">
<p class="admonition-title">Note</p>

In practice, most users mix models — using cheaper models for simple tasks and premium models for complex ones.

</aside>

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

Access your subscription details via **Settings** → **Subscription** tab ([direct link](https://apertis.ai/setting?tab=subscription)):

- Current plan and billing cycle
- Quota usage (used / limit)
- Next billing date
- Payment history

<aside class="admonition admonition-tip">
<p class="admonition-title">Tip</p>

After subscribing, the navbar **Subscribe** button changes to **My Plan** — click it to jump directly to your subscription settings. You can also find **My Plan** in the user dropdown menu.

</aside>

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

1. Go to **Settings** → **Subscription** tab (or click **My Plan** in the navbar)
2. Click **Cancel Subscription**

- You may cancel a subscription at any time from your account Settings. Cancellation stops the next renewal.
- Your subscription remains active until the end of the period you have already paid for, as shown in your account. Cancellation does not, by itself, refund any part of that period.
- Turning off automatic top-up stops future automatic top-ups only. It is separate from your subscription, and changing one does not change the other.
- If a payment was already in progress when you cancel, we check the status of that original payment; we do not charge it again.
- We do not require you to contact us or take extra steps to cancel.

<aside class="admonition admonition-note">
<p class="admonition-title">Note</p>

After cancellation, your subscription API key will stop working at the end of the paid period.

</aside>

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

### Finding Your Subscription Token

After subscribing, find your dedicated API key in **Settings** → **API Keys** tab ([direct link](https://apertis.ai/setting?tab=keys)):

1. Click **My Plan** in the navbar (or go to **Settings**)
2. Switch to the **API Keys** tab
3. Your subscription key (`sk-sub-...`) is listed with integration guides

### Using Your Subscription Token

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-sub-your-subscription-key",
    base_url="https://api.apertis.ai/v1"
)

# Quota is tracked against your subscription
response = client.chat.completions.create(
    model="claude-sonnet-4-6",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

### Viewing Available Models

Use your subscription token to query which models are available in your plan:

```python
# List all models in your plan
models = client.models.list()
for model in models:
    print(model.id)
```

The `/v1/models` endpoint returns only models included in your current plan, along with extra fields like `multiplier` (quota cost) and `tier` (model origin). See [Models API](/api/utilities/models) for details.

## FAQ

### What happens when my quota runs out?

- **With PAYG enabled**: API continues working, charged to your balance
- **Without PAYG**: API returns `402 Payment Required` error

### Can I change my billing cycle?

Yes, you can switch between monthly, quarterly, and yearly at renewal time.

### Is there a free trial?

Contact support for trial options and promotional offers.

### Can I get a refund?

**TODO(refund-policy-v2-date):** the announcement, notice and effective dates of this Refund Policy version are not decided yet. Do not publish while this line is present.

The full Refund Policy is at [https://apertis.ai/refund](https://apertis.ai/refund). The section numbers below refer to it.

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

**How to request a refund** (Section 10). Email hi@apertis.ai with:

1. The email address of your Apertis account.
2. The transaction: an invoice or receipt number, or the date and amount of the charge.
3. The reason for the request and any information that supports it.

Never send a full card number or card security code (CVC). We will not ask for them.

- We record the time we receive your request. That time, not the time we finish reviewing it, is the one that counts for any deadline.
- We aim to send an initial response within 3 business days. This is a response target; it does not shorten or extend any right or deadline you have.

## Related Topics

- [API Keys](/authentication/api-keys) - Manage your API keys
- [Rate Limits](/billing/rate-limits) - Understand request limits
- [Troubleshooting](/help/troubleshooting) - Common issues and solutions
