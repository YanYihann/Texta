# WeChat mini program login and email association

WeChat quick login creates a free account for a new app-scoped identity. Email is optional. Account settings offer a new email/password on the same user ID or an explicit association with an existing email account using its original password. No email OTP service is configured; setting a new email follows existing registration rules, while merging an existing account proves possession of its password.

## API

- GET /api/auth/wechat/status reports configured capability and binding without returning OpenID.
- POST /api/auth/wechat/login accepts only a fresh code. User and WechatIdentity creation is atomic and unique constraints handle concurrent first logins. Session creation locks the current user in a serializable transaction so merging cannot issue a session for a retired account. No client-supplied user ID, OpenID, role or plan is trusted.
- POST /api/auth/wechat/email requires the current authenticated WeChat-only account. An unused email adds a salted password hash in place. With mergeExisting: true, an existing email requires its current password; five failed password attempts per source account trigger a 15-minute limit on this server instance. Old clients without the flag receive a conflict rather than silently merging.
- POST /api/auth/wechat/bind adds an unclaimed WeChat identity to an authenticated email account and never overwrites another binding.

## Merge behavior

An ordinary free WeChat-only account with no payment orders may be merged into the verified email account. Paid source accounts, any source payment history, a conflicting target WeChat binding, changed account state, or an oversized merged library return a conflict without changing either account. The target's role, password, plan, permanent plan and expiry remain unchanged. This is an explicit user action, not automatic discovery or merging based only on email text.

The serializable transaction locks both users in stable order, rereads ownership, transfers all source WeChat identities, folders, favorites, notebook entries, vocabulary preferences, usage logs and legacy requests, and adds daily usage. Client IDs for favorites/folders are retained under the target owner prefix; colliding records use the newer timestamp, and deletion tombstones survive. Notebook words and mastery are deduplicated by word key, use the newest state and retain the first introduction date. Caps are 200 favorites/folders, 2,000 notebook entries and 5,000 vocabulary preferences; overflow rolls back instead of truncating.

The source User is retired with mergedIntoId rather than deleted. All source sessions are revoked and one new target session is issued only to the password-verified request; existing target sessions remain valid. Credit reservation and payment checkout stop on retired users, and in-flight generation logs/refunds follow migrated usage. Merged target accounts protect stored library rows from omission by older client snapshots; explicit newer tombstones handle deletion. JSON nulls are converted to Prisma's write sentinel when preserving stored records.

The mini program synchronizes the source before requesting the merge, checks account-switch races, migrates local collections/history, and switches to the returned target session. The old isolated local cache is retained as a backup. Failed pre-sync does not send credentials. No server-generated reading history exists beyond saved favorites, and this does not move history from another device's local storage.

AppSecret stays on the server. WeChat session_key and UnionID are not stored or returned. Codes are used immediately and not stored locally. Raw upstream errors, request URLs and credentials are not logged or returned. No phone, avatar or WeChat nickname is collected.

## Deployment and validation

Keep the existing Render WECHAT_APP_ID and WECHAT_APP_SECRET. The build runs npm install, prisma generate and prisma db push --skip-generate, adding nullable mergedIntoId and default-false libraryMergeProtected without deleting account/library records. Mini program 1.1.2 supersedes 1.1.1; update privacy disclosures about explicit verified account association before submission/release. Existing clients keep their login functionality but need the new UI for association.

npm run test:wechat covers credential validation, source authorization, data/plan/usage preservation, old-session revocation, identity/paid-source conflicts, rollback, serialization retries and late refunds using in-memory transaction doubles. npm run test:library covers older-snapshot preservation, JSON null serialization and retired-source write rejection. Mini tests cover local migration, failed pre-sync, forged responses and account-switch races. Existing billing tests remain applicable.

tests/account-merge-database.cjs provisions only a randomly named texta_merge_test_* schema and removes it after PostgreSQL concurrency/rollback tests. It never pushes the public schema. This run could not connect to PostgreSQL from the local host and is not claimed as passed; model doubles cannot prove PostgreSQL locking. Simulator fixtures and real WeChat repeat login provide separate runtime/credential checks; merging a real user email requires that user's original password and remains a phone acceptance check.
