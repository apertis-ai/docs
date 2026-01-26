# Payment Methods

Apertis supports multiple payment methods to accommodate users worldwide. This guide explains the available options and how to manage them.

## Supported Payment Methods

| Method | Availability | Currencies | Processing Time |
|--------|--------------|------------|-----------------|
| Credit/Debit Card | Global | USD | Instant |

All payments are securely processed through **Stripe**.

## Credit & Debit Cards

### Supported Cards

We accept major credit and debit cards through Stripe:

- Visa
- Mastercard
- American Express
- Discover
- JCB
- UnionPay

### Adding a Card

1. Go to **Billing** → **Payment Methods**
2. Click **Add Payment Method**
3. Enter card details:
   - Card number
   - Expiration date
   - CVC/CVV
   - Billing address
4. Click **Save**

### Card Security

All card transactions are processed through Stripe, a PCI DSS Level 1 certified payment processor. We never store your full card number.

### Default Payment Method

Set a default payment method for:
- Subscription renewals
- Auto top-up charges
- Future purchases

**To set default:**
1. Go to **Payment Methods**
2. Find the card
3. Click **Set as Default**

### Removing a Card

1. Go to **Payment Methods**
2. Find the card to remove
3. Click **Remove**

:::caution
You cannot remove a card if it's:
- The only payment method for an active subscription
- Set for auto top-up
:::

### Card Declined

If your card is declined:

| Reason | Solution |
|--------|----------|
| Insufficient funds | Ensure adequate balance |
| Card expired | Update with new card |
| Incorrect details | Verify card information |
| Bank block | Contact your bank to allow the transaction |
| International block | Enable international transactions |

## Auto Top-Up

### What is Auto Top-Up?

Automatically add funds when your balance drops below a threshold. Ensures uninterrupted API access.

### Setting Up Auto Top-Up

1. Go to **Billing** → **Auto Top-Up**
2. Toggle **Enable Auto Top-Up**
3. Set **Threshold** (e.g., $10)
4. Set **Top-Up Amount** (e.g., $50)
5. Select **Payment Method**
6. Save settings

### How It Works

```
Balance drops below $10 (threshold)
        ↓
System charges $50 to your card
        ↓
Balance increases by $50
        ↓
Continue using API without interruption
```

### Configuration Options

| Setting | Description | Recommended |
|---------|-------------|-------------|
| Threshold | Balance level to trigger | $10-$50 |
| Amount | Amount to add each time | $20-$100 |
| Payment Method | Card to charge | Default card |

### Auto Top-Up Best Practices

| Usage Level | Threshold | Amount |
|-------------|-----------|--------|
| Light | $5 | $20 |
| Moderate | $20 | $50 |
| Heavy | $50 | $100 |
| Enterprise | $100+ | $500+ |

### Disabling Auto Top-Up

1. Go to **Billing** → **Auto Top-Up**
2. Toggle **Off**
3. Save changes

## Invoices & Receipts

### Accessing Invoices

1. Go to **Billing** → **Invoices**
2. Select the invoice
3. Download PDF

### Invoice Contents

Each invoice includes:
- Invoice number
- Date
- Amount and currency
- Payment method
- Usage summary (optional)
- Tax information (if applicable)

### Tax Information

To add tax ID or company information to invoices:

1. Go to **Account Settings** → **Billing Information**
2. Enter:
   - Company name
   - Tax ID / VAT number
   - Billing address
3. Save changes

This information appears on all future invoices.

### Receipts

Receipts are generated automatically for each payment:

1. Go to **Billing** → **Payment History**
2. Find the transaction
3. Click **Receipt**

## Payment Troubleshooting

### Payment Failed

Common causes and solutions:

| Cause | Solution |
|-------|----------|
| Insufficient funds | Add funds to your bank account |
| Card expired | Update payment method |
| Fraud protection | Contact bank to allow |
| Incorrect CVV | Re-enter card details |
| Billing address mismatch | Update address to match bank records |

### Duplicate Charges

If you see duplicate charges:

1. Wait 24 hours (temporary holds may clear)
2. Check if both actually completed
3. Contact support with transaction details

### Refund Requests

For refund requests:

1. Email hi@apertis.ai
2. Include:
   - Account email
   - Transaction date
   - Amount
   - Reason for refund

Processing time: 5-10 business days

## Regional Payment Options

### Global
- All major credit/debit cards (Visa, Mastercard, American Express, JCB, UnionPay)
- Processed securely through Stripe

## Enterprise Payment Options

For enterprise customers with specific requirements:

- Wire transfer
- Purchase orders
- Custom billing cycles
- Volume discounts

Contact sales: hi@apertis.ai

## Security Best Practices

### Protecting Payment Information

1. **Use strong account password**
2. **Enable 2FA** on your account
3. **Monitor transactions** regularly
4. **Set spending limits** on API keys
5. **Review invoices** monthly

### Fraud Prevention

We implement multiple fraud prevention measures:
- 3D Secure for card payments
- Address verification (AVS)
- CVV verification
- Transaction monitoring
- Suspicious activity alerts

## FAQ

### Can I pay annually?

Yes, subscription plans offer monthly, quarterly, and yearly billing cycles. Annual billing typically offers discounts.

### Is my payment information secure?

Yes. All payments are processed by Stripe, a PCI DSS Level 1 certified payment processor. We never store full card numbers.

### Can I get a paid receipt?

Yes, invoices and receipts are available in the Billing section for all transactions.

### What currency are charges in?

All charges are in USD, with local currency conversion handled by your bank or payment processor.

### Why was my payment declined?

Common reasons include insufficient funds, expired card, bank security blocks, or incorrect billing information. Contact your bank for specific details.

## Related Topics

- [Subscription Plans](./subscription-plans) - Plan options
- [Quota Management](./quota-management) - Managing usage
- [PAYG](./payg) - Pay-as-you-go billing
- [FAQ](../help/faq) - Common questions
