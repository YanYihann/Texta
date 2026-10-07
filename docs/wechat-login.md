# WeChat mini program login

The default mini program flow is WeChat quick login. The server verifies wx.login, creates a free account for a new app-scoped identity, and issues a normal Texta session immediately. Email and password are optional; users can add them later in account settings to sign in on the web using the same user ID, data, plan and quota. Email ownership is not verified by an OTP service; this matches the existing email registration flow.

## API and identity storage

- GET /api/auth/wechat/status reports configured capability and the signed-in account's binding without returning OpenID.
- POST /api/auth/wechat/login accepts only a fresh code. Existing identities use their current user; a new identity creates User and WechatIdentity in one transaction. A duplicate first-login race rolls back the losing user and loads the winner. Sessions use the existing bearer format and TTL. No client-supplied user ID, OpenID, role or plan is trusted.
- POST /api/auth/wechat/email requires an authenticated account with a WeChat identity. It adds a valid unused email and a salted password hash only when that account has no email. The conditional update and unique email constraint prevent overwrite and concurrent claims. Roles, plan and user ID stay unchanged, including when the address matches an admin email configuration.
- POST /api/auth/wechat/bind remains available to add an unclaimed WeChat identity to a signed-in existing email account. It never reassigns an identity that already belongs to another account.

User.email and User.passwordHash are nullable for WeChat-only users; no fake email or password is created. The public profile renders missing email as an empty string. The schema keeps unique identity and email constraints. There is no silent account merge, email replacement, automatic phone/avatar/nickname collection, or unlink flow. An email belonging to another account returns a conflict and leaves both accounts intact.

AppSecret stays on the server. WeChat session_key and UnionID are not stored or returned. Codes are used immediately and not stored locally. Raw upstream errors, request URLs and credentials are not logged or returned.

## Deployment

Keep the existing Render WECHAT_APP_ID and WECHAT_APP_SECRET. Deploy this revision using the existing build (npm install, prisma generate, prisma db push --skip-generate). This makes the two optional fields nullable without removing current email accounts or their data. Do not run local schema push against production as a test.

Upload mini program 1.1.1 and update privacy disclosures: first WeChat login creates an account from the app-scoped identifier; email and password are provided only when the user elects to enable web login. Existing 1.1.0 clients accept the returned normal session as well. Test a real phone, then submit/release in the console. Only the server calls WeChat APIs; the mini program keeps the existing Texta request domain.

## Verification

npm run test:wechat covers provider failures, identifier spoofing, first creation and repeated login, atomic rollback, concurrent first logins, optional email credentials, conflicts and ownership. HTTP tests use an in-memory database double and do not prove real PostgreSQL concurrency. Prisma validation/client generation and existing library/billing tests cover their respective scopes.

Mini program tests cover default direct login, optional email settings, data/session preservation, conflicts, duplicate taps, consent and account-switch races. scripts/wechat-first-smoke.cjs exercises the actual simulator with wx.login/API fixtures and restores original state. Real WeChat credential checking and phone account binding remain separate checks.
