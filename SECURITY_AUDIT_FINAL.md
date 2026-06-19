# Production Readiness Audit Round 2

Date: 2026-06-20

Scope: full repository review after the latest authentication, ownership, CSRF, ticket lookup, and rate limiting fixes. This audit did not execute migrations or modify application code.

## Executive Summary

The repository is materially stronger than the first audit: `uploadPaymentProof`, `getByMerchantUid`, and `tickets.getByCode` now require authentication and ownership or role checks; admin and staff mutations use CSRF protection; QR scanner endpoints are staff/admin-only; and targeted rate limits exist.

The project is not production-ready yet. The main blockers are a public mock payment webhook that can mark orders paid, non-transactional payment approval and ticket issuance, non-atomic scanner check-in behavior, process-local rate limiting, storage privacy gaps, and a CORS/CSRF deployment mismatch.

## Critical Findings

### C1. Public mock payment webhook can issue paid tickets

Location:
- `server/routers/orders.ts:354`
- `server/routers/orders.ts:366`
- `server/routers/orders.ts:401`
- `server/routers/orders.ts:419`
- `server/routers/orders.ts:431`

`paymentWebhook` remains a `publicProcedure`. It accepts `merchantUid` and `paidAmount`, compares `paidAmount` to the order total, marks the order as `PAID`, creates a payment, and issues tickets. `providerSignature` is accepted by the schema but is never verified.

Impact:
- Anyone who can obtain or guess a valid `merchantUid` and amount can bypass admin payment proof approval and create tickets.
- `createPending` is also public and returns `merchantUid`, so a user can create a pending order and then call the public webhook to self-approve payment.

Required fix:
- Remove or disable the mock webhook in production.
- If keeping a webhook, move it to a raw Express endpoint with provider signature verification.
- Require a real payment provider secret and reject unsigned requests.
- Add rate limiting and audit logging to the webhook endpoint.

### C2. Payment approval and ticket issuance are not transactional

Location:
- `server/routers/orders.ts:539`
- `server/routers/orders.ts:542`
- `server/routers/orders.ts:544`
- `server/routers/orders.ts:548`
- `server/routers/orders.ts:558`
- `server/routers/orders.ts:565`
- `server/db.ts:348`
- `server/db.ts:450`
- `server/db.ts:519`

Admin approval updates payment status, marks the order paid, creates ticket rows, uploads QR images, updates QR data, and marks the proof approved as separate operations.

Impact:
- If QR upload fails after `markOrderPaid`, the order can be `PAID` without complete tickets.
- If ticket creation fails midway, some tickets can exist while others are missing.
- If proof approval fails at the end, payment/order/tickets can be committed while the proof remains pending.

Required fix:
- Move payment status, order status, proof status, and ticket creation into a database transaction.
- Treat external QR image upload carefully: either upload before DB commit and persist only after all uploads succeed, or generate/store QR data in a retryable post-commit job with an explicit issuance state.
- Make approval idempotent by checking existing tickets for the order before creating new ones.

### C3. Scanner check-in can report duplicate success under race conditions

Location:
- `server/routers/tickets.ts:184`
- `server/routers/tickets.ts:231`
- `server/routers/tickets.ts:232`
- `server/routers/tickets.ts:233`
- `server/routers/tickets.ts:239`
- `server/db.ts:495`
- `server/db.ts:636`

`scannerCheckIn` resolves the ticket, sees status `VALID`, then calls `markTicketUsed`. `markTicketUsed` conditionally updates `WHERE status = VALID`, but it does not return or check `affectedRows`. The caller always logs `SUCCESS` and records attendance afterward.

Impact:
- Two concurrent scans of the same valid token can both return success even though only one update actually changed the ticket.
- Attendance is unique by ticket, but `recordAttendance` uses upsert and can overwrite staff/scan log data.

Required fix:
- Make check-in a single transaction.
- Have `markTicketUsed` return affected row count.
- Only log `SUCCESS` and record attendance if exactly one row was updated.
- If zero rows were updated, re-read the ticket and return `ALREADY_USED` or the current terminal status.

## High Findings

### H1. Rate limiting is process-local and bypassable in production

Location:
- `server/_core/rateLimit.ts:16`
- `server/_core/rateLimit.ts:30`
- `server/_core/rateLimit.ts:55`
- `server/_core/rateLimit.ts:62`

The limiter stores buckets in a module-level `Map`.

Impact:
- Limits reset on process restart.
- Limits are not shared across multiple instances, serverless invocations, or horizontally scaled deployments.
- Attackers can bypass limits by distributing requests across instances.

Required fix:
- Move rate limiting state to Redis, Upstash, Cloudflare KV/Durable Objects, or the deployment provider's edge rate limiter.
- Keep current in-memory limiter only as a development fallback.

### H2. Cross-origin CSRF-protected mutations may fail because CORS does not allow `x-csrf-token`

Location:
- `server/_core/index.ts:32`
- `server/_core/index.ts:40`
- `server/_core/csrf.ts:8`
- `client/src/main.tsx` sends the `x-csrf-token` header.

CORS allows `content-type, authorization, x-trpc-source`, but not `x-csrf-token`.

Impact:
- Same-origin deployments can work.
- Split frontend/API production deployments using `VITE_API_URL` can fail browser preflight requests for every CSRF-protected mutation.

Required fix:
- Add `x-csrf-token` to `Access-Control-Allow-Headers`.
- Add an integration test for cross-origin CSRF mutation requests.

### H3. Receipt and QR storage URLs are publicly dereferenceable by key

Location:
- `server/storage.ts:71`
- `server/_core/storageProxy.ts:13`
- `server/_core/storageProxy.ts:28`
- `server/_core/storageProxy.ts:50`

Uploaded receipts and QR images are exposed through `/manus-storage/{key}`. The storage proxy does not authenticate or authorize access to a requested key; it signs and redirects any key path.

Impact:
- Receipt URLs are hidden from non-admin API responses, but anyone who obtains a receipt path can access it.
- QR images can also be accessed by URL.

Required fix:
- Require authorization in the storage proxy for sensitive prefixes such as `payment-proofs/`.
- Use separate public/private storage buckets or signed URLs with short TTLs.
- Avoid storing receipt paths in client-visible objects unless needed for admin workflows.

### H4. Ticket number generation is race-prone

Location:
- `server/routers/orders.ts:70`
- `server/routers/orders.ts:544`
- `server/routers/orders.ts:548`
- `server/db.ts:531`

Ticket numbers are generated by reading the latest code for the year and incrementing in memory.

Impact:
- Concurrent approvals can generate the same `FT-YYYY-000001` values.
- Unique constraints may prevent duplicate inserts, but approval can fail after order/payment status was already changed.

Required fix:
- Use a database-backed sequence table or transactional counter row per year.
- Generate ticket numbers inside the same transaction that creates tickets.

### H5. `tickets.getByCode` is a query that can mutate ticket hashes

Location:
- `server/routers/tickets.ts:89`
- `server/routers/tickets.ts:109`
- `server/routers/tickets.ts:119`

The endpoint is a protected query, but it can call `db.updateTicketHash` when a ticket has no stored QR image.

Impact:
- A read operation changes security state.
- Because tRPC queries are not CSRF-protected by design, this creates a state-changing path outside CSRF protection.
- Old QR tokens can be invalidated by viewing the ticket.

Required fix:
- Do not rotate QR token hashes from `getByCode`.
- Store the original QR token securely if it must be shown later, or always create `qrImageUrl` at issuance time.
- If migration is needed for legacy tickets, implement a one-time admin-only repair job.

### H6. Admin queries return full raw order/proof/ticket rows

Location:
- `server/routers/orders.ts:468`
- `server/routers/orders.ts:480`
- `server/routers/tickets.ts:265`
- `server/routers/tickets.ts:287`
- `server/routers/tickets.ts:288`

Admin endpoints return raw rows including buyer emails, phones, payment keys, QR token hashes, and internal timestamps.

Impact:
- Admin access is required, so this is not public exposure.
- However, it expands blast radius for compromised admin sessions and frontend logs.

Required fix:
- Sanitize admin DTOs to only fields used by the admin UI.
- Never return `qrTokenHash` to the browser.

## Medium Findings

### M1. `createPending` allows guest orders, but later owner-only flows require authentication

Location:
- `server/routers/orders.ts:154`
- `server/routers/orders.ts:213`
- `server/routers/orders.ts:267`
- `server/routers/orders.ts:286`

`createPending` is public and stores `userId: ctx.user?.id`, which can be `null`. `uploadPaymentProof` now requires ownership and therefore rejects guest-created orders.

Impact:
- A guest can create an order but cannot complete the payment proof flow.
- This is a functional production blocker if guest checkout is expected.

Required fix:
- Require authentication for `createPending`, or explicitly redirect users to sign in before checkout.
- If guest checkout is required, implement secure email-token ownership rather than public merchant UID capability.

### M2. Receipt upload validates MIME from data URL and file extension, but not file magic bytes

Location:
- `server/routers/orders.ts:25`
- `server/routers/orders.ts:29`
- `server/routers/orders.ts:44`
- `server/routers/orders.ts:299`

The upload parser checks the data URL MIME and filename extension, then decodes base64 and enforces a 10MB limit.

Impact:
- A non-image payload can be disguised as `image/png`.
- The storage layer will serve it with the claimed content type.

Required fix:
- Validate magic bytes for JPEG, PNG, and WebP.
- Optionally re-encode images server-side before storage.

### M3. Express JSON body limit is larger than receipt policy

Location:
- `server/_core/index.ts:79`
- `server/_core/index.ts:80`
- `server/routers/orders.ts:21`

The app accepts 50MB JSON bodies, while receipt policy is 10MB decoded image size.

Impact:
- Base64 overhead plus request parsing can consume memory before application validation.
- Attackers can send large requests to any JSON endpoint.

Required fix:
- Lower the global JSON limit or add route-specific upload handling.
- Prefer multipart streaming upload with size checks before buffering the entire file.

### M4. CSRF token is a readable double-submit cookie

Location:
- `server/_core/csrf.ts:90`
- `server/_core/csrf.ts:93`

The token is intentionally readable by JavaScript so the client can echo it in a header.

Impact:
- This is a common pattern, but XSS would allow an attacker to read the CSRF token.
- Origin validation reduces CSRF risk but does not address XSS.

Required fix:
- Keep origin validation.
- Add strong Content Security Policy.
- Avoid inline scripts where possible.

### M5. Admin approval lacks payment amount/proof reconciliation

Location:
- `server/routers/orders.ts:535`
- `server/routers/orders.ts:539`
- `server/routers/orders.ts:542`

Admin approval sets payment to `PAID` and order to `PAID` but does not verify the related payment amount against the order total at approval time.

Impact:
- If payment rows are malformed or manipulated, approval can finalize an inconsistent payment.

Required fix:
- Verify payment exists, belongs to the order, is `PENDING_VERIFICATION`, and amount equals `order.totalAmount`.

### M6. No persistent audit trail for admin identity on order state changes

Location:
- `server/routers/orders.ts:627`
- `server/routers/orders.ts:653`
- `server/db.ts:405`

Payment proof review stores `reviewedByUserId`, but general admin cancel/resend operations do not persist an admin action log.

Impact:
- Incident investigation is limited for administrative changes.

Required fix:
- Add an `admin_audit_logs` table and record admin id, action, target, old state, new state, IP, and timestamp.

## Low Findings

### L1. Frontend routes are not guarded, relying on backend errors

Location:
- `client/src/App.tsx:35`
- `client/src/App.tsx:36`
- `client/src/App.tsx:37`
- `client/src/App.tsx:38`
- `client/src/App.tsx:39`

Admin and scanner pages are routable client-side. Backend procedures enforce permissions, so this is not an authorization bypass.

Impact:
- Unauthorized users may briefly see layout shells or error states.

Required fix:
- Add route-level frontend guards for user experience only.
- Keep backend authorization as the source of truth.

### L2. Login is rate-limited, but signup is not

Location:
- `server/routers.ts:65`
- `server/routers.ts:118`

Login has `10/minute` per IP. Signup is public and not rate-limited.

Impact:
- Account creation can be abused for spam or resource consumption.

Required fix:
- Add signup rate limiting and email verification before production launch.

### L3. Production env validation only fails fast for `JWT_SECRET`

Location:
- `server/_core/env.ts:49`
- `server/_core/env.ts:53`

Startup validation requires `JWT_SECRET` in production but does not fail fast for `DATABASE_URL`, `FRONTEND_URL`, storage credentials, or OAuth URLs.

Impact:
- Misconfigured production deployments can start and fail at runtime.

Required fix:
- Validate all required production variables at startup.

### L4. Existing build warnings for analytics placeholders

Location:
- `client/index.html`

The build reports missing `%VITE_ANALYTICS_ENDPOINT%` and `%VITE_ANALYTICS_WEBSITE_ID%` placeholders.

Impact:
- Not a direct security issue, but it is a deployment hygiene issue.

Required fix:
- Configure analytics env vars or remove the placeholder script.

## Area-by-Area Review

### 1. Authentication

Current state:
- Password signup/login exists.
- Session cookies are signed with `JWT_SECRET`.
- Production startup fails when `JWT_SECRET` is empty.
- Login is rate-limited.

Gaps:
- Signup is not rate-limited.
- No email verification.
- Logout remains a public mutation and not CSRF-protected.

Readiness: partially ready.

### 2. Authorization

Current state:
- Admin procedures require `role === "admin"`.
- Staff scanner procedures require `role === "admin"` or `role === "staff"`.
- `getByMerchantUid`, `uploadPaymentProof`, and `getByCode` now enforce ownership or role access.

Gaps:
- Admin responses return more raw data than necessary.
- Client routes are not frontend-guarded.

Readiness: mostly ready at backend authorization level.

### 3. QR Security

Current state:
- QR tokens are HMAC-signed.
- Scanner verifies signature and DB token hash.
- QR payload contains ticket id/code/nonce/issued-at, not buyer PII.
- `qrTokenHash` is no longer returned by customer ticket lookup.

Gaps:
- `getByCode` can rotate token hashes.
- No expiration or versioning strategy for QR tokens.
- Admin report can still return raw ticket rows including hashes.

Readiness: needs hardening.

### 4. Receipt Upload Security

Current state:
- Authenticated owner-only upload.
- CSRF-protected mutation.
- File types limited to jpg/jpeg/png/webp through data URL MIME and filename extension.
- Decoded receipt size limited to 10MB.
- Receipt URL hidden from non-admin order lookup.

Gaps:
- No magic-byte validation.
- Storage proxy authorizes no sensitive prefixes.
- Global body parser allows 50MB.

Readiness: partially ready.

### 5. Admin Approval Flow

Current state:
- Admin-only and CSRF-protected.
- Can approve/reject payment proofs.
- Rejection reason is stored.
- Approval creates tickets with QR images and `VALID` status.

Gaps:
- Not transactional.
- Payment amount/status reconciliation is incomplete.
- Race-prone ticket numbering.

Readiness: not production-ready until transactional.

### 6. Ticket Generation Flow

Current state:
- Ticket numbers are human-readable `FT-YYYY-000001`.
- Tickets store hashed QR token and optional QR image URL.
- Ticket status uses existing `VALID`.

Gaps:
- Sequential number generation is race-prone.
- Public mock payment flow can create tickets without QR images.
- Partial issuance can occur on failures.

Readiness: not production-ready until transactional/idempotent.

### 7. Scanner Flow

Current state:
- Staff/admin-only.
- CSRF-protected.
- Rate-limited.
- Verifies signed token and DB hash.
- Handles invalid, used, cancelled, expired statuses.

Gaps:
- Check-in is not atomic under concurrency.
- Success logging does not confirm the update actually changed a row.

Readiness: needs atomic check-in fix.

### 8. Attendance Flow

Current state:
- Attendance has a unique ticket constraint.
- Scan logs are created for invalid and terminal-state scans.
- Admin report computes total/used/remaining/attendance percentage.

Gaps:
- Attendance upsert can overwrite staff/scan metadata on duplicate check-ins.
- Admin report returns raw ticket rows.

Readiness: needs audit and data-minimization hardening.

### 9. Rate Limiting Coverage

Current state:
- Login: 10/minute per IP.
- Upload: 10/minute per user.
- Order lookup: 30/minute per IP.
- Ticket lookup: 30/minute per IP.
- Scanner verify/check-in: 60/minute per staff/admin user.

Gaps:
- In-memory only.
- No signup/createPending/paymentWebhook rate limits.
- IP extraction trusts `x-forwarded-for` without trusted proxy configuration.

Readiness: development-ready, not production-grade.

### 10. Error Handling

Current state:
- Uses tRPC errors for expected auth/access/validation failures.
- Startup has clear `JWT_SECRET` failure handling.
- Storage proxy returns generic `502` responses to clients.

Gaps:
- Several DB helpers silently return when DB is unavailable, which can hide partial failure.
- Multi-step operations can fail after earlier writes commit.

Readiness: needs production error-path tightening.

### 11. Database Transaction Safety

Current state:
- Stock reservation and pending order creation use a transaction.

Gaps:
- Payment proof upload creates payment, proof, order update, and log separately.
- Payment approval is not transactional.
- Ticket issuance is not transactional.
- Scanner check-in is not transactional.
- Admin cancellation is not transactional.

Readiness: not production-ready for high-concurrency use.

### 12. Production Blockers

Must fix before launch:
1. Remove or secure the public mock `paymentWebhook`.
2. Make payment approval and ticket issuance transactional and idempotent.
3. Make scanner check-in atomic and verify affected rows.
4. Replace in-memory rate limiting with shared production infrastructure.
5. Protect private receipt storage paths or use private signed URLs.
6. Add `x-csrf-token` to CORS allowed headers for cross-origin deployments.
7. Decide whether checkout requires authentication before `createPending`; currently guest orders cannot complete the receipt flow.
8. Validate all required production env vars at startup.

## Positive Findings

- Ownership checks were added to `uploadPaymentProof`.
- Ownership/admin checks were added to `getByMerchantUid`.
- Owner/staff/admin checks were added to `tickets.getByCode`.
- CSRF protection uses origin validation and timing-safe token comparison.
- Scanner endpoints are staff/admin-only and CSRF-protected.
- Receipt URL exposure was reduced for non-admin order lookup.
- Core security behaviors now have automated tests.

## Final Readiness Verdict

Production readiness: **not ready**.

Security posture after the latest fixes: **improved, but still blocked by payment finalization, transactional consistency, scanner race safety, storage privacy, and deployment-grade rate limiting.**
