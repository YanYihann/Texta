# Texta payment activation

Current store: `texta.onfastspring.com`, **Test**. Public purchases remain disabled until the store is approved and a complete payment test has passed.

Configured on 2026-10-05: the four one-time products below, Chinese names and descriptions, CNY-only catalog prices, checkout path `texta/popup-texta`, API credentials and HMAC secret stored in the existing Render `texta-backend` service, and the `Texta Payment Webhook` endpoint with `order.completed`, Live and Test sources, expansion disabled. Render configuration deployed successfully. The API credentials and webhook secret are excluded from this repository.

All four actual FastSpring Test session requests returned 201 with CNY tax-inclusive totals 9.90, 19.90, 49.90 and 99.90. The Chinese checkout displayed Alipay. The server accepted a signed Test notification with HTTP 200 and rejected an unsigned notification with HTTP 401; public `paymentsAvailable` remained false. These checks alone do not establish that an actual completed FastSpring order has delivered its webhook.

Outstanding Test checkout issue: submitting FastSpring's official success test card (4242) in the CNY V2 hosted session returned the provider message `在测试模式中不支持` (“Not supported in test mode”). The session remained OPEN. No successful provider-generated order/webhook or Alipay QR payment has been verified; resolve this with FastSpring's checkout configuration/support before Live activation. Do not infer a successful payment from session creation or the synthetic signed notification test.

## Catalog

Create four **one-time products**, with quantity fixed to 1, no coupons, cross-sells, subscriptions or extra fees:

| Product path | Display name | Final CNY price | Access |
| --- | --- | --- | --- |
| `texta-plus-30` | Plus 月度套餐 | 9.90 | One month, 50 credits/day |
| `pro-monthly` | Pro 月度套餐 | 19.90 | One month, 150 credits/day |
| `plus-lifetime` | 永久 Plus | 49.90 | Lifetime, 50 credits/day |
| `pro-lifetime` | 永久 Pro | 99.90 | Lifetime, 150 credits/day |

The existing Plus product path is preserved through `FASTSPRING_PRODUCT_PLUS_MONTHLY=texta-plus-30`. CNY is already available in the store. Test sessions for China calculated zero added tax and the exact advertised totals. The server refuses a mismatched checkout before showing it. V2 sessions require explicit `quantityBehavior: LOCK`; the catalog quantity lock alone was not carried into the generated session. Verify applicable FastSpring fees with your account representative; they are separate from the site's credit allowance.

Monthly products are prepaid, do not auto-renew, and expire one calendar month after activation. Same-plan renewal extends the existing expiry. Upgrading from monthly Plus to Pro starts a new Pro month without crediting the unused Plus period; the confirmation explains this. A permanent Plus entitlement remains underneath temporary Pro and resumes when Pro expires.

## Checkout and server environment

Create a Web Checkout for the store, enable Alipay where eligible, and copy its actual checkout identifier. Do not assume `main` exists. Set these in the backend host's secret environment, never in Git or frontend JavaScript:

```dotenv
BILLING_ENABLED=false
FASTSPRING_MODE=test
FASTSPRING_CHECKOUT_PATH=texta/popup-texta
FASTSPRING_USERNAME=YOUR_API_USERNAME
FASTSPRING_PASSWORD=YOUR_API_PASSWORD
FASTSPRING_WEBHOOK_SECRET=UNIQUE_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
FASTSPRING_PRODUCT_PLUS_MONTHLY=texta-plus-30
```

Optional product mapping overrides: `FASTSPRING_PRODUCT_PLUS_MONTHLY`, `FASTSPRING_PRODUCT_PRO_MONTHLY`, `FASTSPRING_PRODUCT_PLUS_LIFETIME`, `FASTSPRING_PRODUCT_PRO_LIFETIME`.

For private configuration checks, `createFastSpring().createTestSession(order)` creates and validates a Test session only when all secrets are configured, `FASTSPRING_MODE=test`, and purchasing is disabled. This method is never exposed through public order routes and does not create a production payment order or grant access.

FastSpring hosts the payment window and generates its Alipay QR code. Texta's waiting dialog displays **支付后，请勿手动关闭弹窗！** and polls its own backend. Browser callbacks never grant a plan; only a verified server webhook does. If the browser blocks the window, the dialog includes an explicit reopen button. FastSpring receives customer payment information directly; Texta's session request sends only the product and an opaque internal order binding.

## Webhook

In Developer Tools → Webhooks, configure:

- URL: `https://api-texta.yanyihan.top/api/billing/fastspring/webhook`
- Event: `order.completed`
- HMAC SHA256 secret: identical to `FASTSPRING_WEBHOOK_SECRET`.
- Disable expansion so item product IDs remain simple strings.
- Test and Live events may share the endpoint; Test events are acknowledged without modifying production entitlements.

The server verifies the original payload signature, live status, order proof, exact CNY total, one allowed product and quantity, then updates the order and user in one serializable database transaction. Duplicate notifications do not extend the plan twice. FastSpring retries non-successful callbacks; inspect its delivery log if activation is delayed. A session-creation timeout is not retried into a second payable session; inspect the order before reopening purchase access for that user.

Refunds and chargebacks currently require manual entitlement review in the admin page. Do not enable real purchases until an operating refund policy and review process are in place. There is no automatic refund or chargeback entitlement reversal in this release.

## Required before Live

1. Complete FastSpring's own identity/business review, payout setup, and required terms/privacy/refund information using accurate owner-supplied details.
2. Supply the four products, actual checkout ID, API credentials and webhook secret through the server environment.
3. In an isolated staging database, simulate the checkout/session/webhook flow and verify actual FastSpring payloads (including `tags.textaOrder` and `tags.textaProof`). The automated repository tests use signed fixtures and a separate database schema; they are **not** proof of a real FastSpring transaction.
4. Confirm final CNY totals, Chinese Alipay availability, window behavior and webhook delivery with FastSpring Test checkout. Test payments must never grant production access.
5. After FastSpring approves the store, set `FASTSPRING_MODE=live` and `BILLING_ENABLED=true` only when the end-to-end checks pass. A paid Live smoke test requires the owner's authorization for its amount.

## References

- https://developer.fastspring.com/docs/activate-your-store
- https://developer.fastspring.com/reference/createsession
- https://developer.fastspring.com/reference/message-security
- https://developer.fastspring.com/reference/ordercompleted
- https://developer.fastspring.com/docs/payment-methods-accepted-by-fastspring
