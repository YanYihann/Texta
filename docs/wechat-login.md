# WeChat mini program login

The mini program can add WeChat login to an existing Texta email account. First-time users sign in or register with email, inspect the target account, and explicitly confirm binding their current WeChat. Subsequent WeChat logins issue a normal Texta session for the same user ID. Plans, usage and learning records keep their existing ownership.

## API and identity storage

- `GET /api/auth/wechat/status`: reports whether credentials are configured and whether the authenticated Texta account has a binding. It returns no OpenID. Missing credentials or a failed capability lookup leave email login available.
- `POST /api/auth/wechat/login`, body `{ "code": "wx.login result" }`: the server exchanges the fresh code with WeChat. An unbound identity returns `{ "ok": true, "bindingRequired": true }` without creating a user or session. A bound identity receives the existing account's public profile and an ordinary Texta bearer session.
- `POST /api/auth/wechat/bind`, authenticated Texta bearer token and a newly obtained code: binds the verified WeChat identity to the authenticated account. The server ignores client-supplied user IDs, OpenIDs and AppIDs. Existing bindings cannot be reassigned by this route.

`WechatIdentity` has unique constraints on `(appId, openId)` and `(appId, userId)`, with a cascading relation to User for account deletion. Concurrent duplicate claims are rejected or treated as idempotent when they belong to the same account. There is no merge, new-account, automatic nickname, phone-number or unlink flow.

AppSecret stays on the API server. WeChat's session_key and UnionID are not stored or returned to the client. Login codes are short-lived, used only for their immediate exchange, and never stored in client storage. Raw provider errors and request URLs are not logged or returned.

## Deployment

1. In the Render backend service's Environment page, add `WECHAT_APP_ID=wxc1af567af0505b1e` and `WECHAT_APP_SECRET=<this mini program's AppSecret>`. Save only if the new backend build is not yet ready. Never commit the secret or put it into miniprogram/config.js.
2. Deploy this backend revision. The repository's Render build runs `npm install && npx prisma generate && npx prisma db push --skip-generate`; this adds the identity table and its indexes/foreign key. No existing account fields are replaced. Do not run local schema changes against a production database as a test.
3. Check `/api/auth/wechat/status` and test a real wx.login code. `enabled: true` reports configuration presence; it alone does not prove that the secret is correct.
4. Upload mini program 1.1.0, update its privacy disclosures to include the app-scoped WeChat identifier and account association, test the first binding on a real device, then submit/release through the mini program console.

The mini program talks only to the existing Texta API domain. Only the API server calls WeChat's HTTPS login endpoint; the client does not need WeChat API domains or secrets in its request-domain list.

## Verification

`npm run test:wechat` tests provider error handling and actual HTTP routes using an in-memory database double, including ownership, client identifier spoofing, duplicate/concurrent binding, deleted accounts and secret redaction. It does not claim to test real PostgreSQL concurrency or actual WeChat credentials. Prisma validation and client generation verify the model syntax. Existing library/billing tests verify that account-owned data and plans remain intact at their tested scope.

The mini program's `tests/wechat.test.cjs` tests consent, first-time email binding, session storage, duplicate taps, native login failure, disabled capability and account-switch races. `scripts/wechat-smoke.cjs` checks the real simulator with mocked wx.login and API responses, restoring original state afterwards; it is separate from real credential and phone testing.
