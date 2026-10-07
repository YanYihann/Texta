# Web WeChat connection status

The study page account menu shows the WeChat connection for the currently signed-in Texta account. It refreshes after account loading, when opening the menu, and when selecting **Refresh status**. Chinese and English copy use the existing translation system; colors follow the selected theme.

An unlinked account can expand three steps for linking the existing email account inside the Texta mini program. The web menu only reads status; it does not create, merge, or remove account connections.

## API contract

`GET /api/auth/wechat/connection` requires the existing Texta session and responds with `Cache-Control: no-store`.

```json
{ "ok": true, "bound": true, "loginAvailable": true }
```

The identity lookup uses the configured mini-program AppID and the authenticated user's ID. Neither OpenID nor other provider identifiers are returned. A saved connection remains `bound: true` if WeChat login is temporarily disabled. Invalid sessions return 401; unavailable configuration or database errors return 503 without inventing an unlinked status.

The UI separates linked, unlinked, login-unavailable, and query-error states. It discards responses after an account/session change and deduplicates in-flight refreshes.

## Validation

- `npm run test:wechat` covers authenticated ownership, retained bindings when login is disabled, private identifier omission, and database failure, alongside existing login/merge tests.
- `node --test tests/web-wechat-state.cjs` covers UI states, stale responses, request deduplication, network failures, and successful retry.
- `node tests/web-wechat-preview.cjs` serves local-only preview fixtures at `http://127.0.0.1:4188/{bound,unbound,offline,paused,expired}/app.html`. It does not proxy production requests. Use a separate local origin; its fixture session is not a production credential.
- Browser verification covers desktop and 390px mobile layouts, expanded help, Chinese/English, light/dark themes, and query failure. The mobile account menu remains scrollable above the bottom navigation.

The web frontend publishes through the existing GitHub Pages workflow. The new read endpoint deploys through the existing Render service. No database migration or mini-program upload is required for this display change.
