# Security Audit Remediation

Date: 2026-06-20

Scope: remediation for the critical production-readiness findings identified in `SECURITY_AUDIT_FINAL.md`.

## Summary

Implemented the requested hardening phase without changing the UI and without running database migrations or `db:push`.

## Fixes Implemented

### 1. Mock payment webhook disabled in production

Changed `orders.paymentWebhook` so it rejects immediately when `NODE_ENV=production`.

Result:
- The mock payment path can still support local development.
- Production callers cannot mark orders paid or issue tickets through the mock webhook.

Files:
- `server/routers/orders.ts`
- `server/orders.security.test.ts`

### 2. Admin approval and ticket issuance made transactional

Added a DB-level transaction helper for payment proof approval and ticket issuance.

The transaction now covers:
- Payment proof validation.
- Payment/order consistency checks.
- Payment status update to `PAID`.
- Order status update to `PAID`.
- Ticket number generation.
- Ticket row creation.
- QR hash/image URL update.
- Payment proof approval.
- Payment audit log insertion.

Additional checks:
- Payment must exist.
- Payment must belong to the order.
- Payment amount must match `order.totalAmount`.
- Payment status must be `PENDING_VERIFICATION`.

Files:
- `server/db.ts`
- `server/routers/orders.ts`

### 3. Duplicate scanner check-in prevented under concurrency

Added an atomic check-in helper that conditionally updates tickets from `VALID` to `USED` and checks affected rows before returning success.

Result:
- Only the request that actually changes the ticket to `USED` can return `SUCCESS`.
- Concurrent or repeated scans return terminal status such as `ALREADY_USED`.
- Success scan log and attendance record are written in the same transaction.

Files:
- `server/db.ts`
- `server/routers/tickets.ts`

### 4. Production-safe rate limiting added

Replaced production in-memory rate limiting with Upstash Redis REST support.

Behavior:
- Development/test: in-memory fallback.
- Production: Redis-backed shared limiter.
- Production without Redis config: fail closed with a configuration error.

Required production env vars:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Files:
- `server/_core/rateLimit.ts`
- `server/_core/env.ts`
- `server/tickets.security.test.ts`

### 5. Receipt and QR file access authorized

Added authorization checks to `/manus-storage/*` for sensitive generated files.

Rules:
- `payment-proofs/*`: admin only.
- `qr-tickets/*`: ticket owner, staff, or admin.
- Other storage paths remain public to preserve existing static asset behavior.

Files:
- `server/_core/storageProxy.ts`
- `server/storageProxy.security.test.ts`

### 6. CORS fixed for CSRF header

Added `x-csrf-token` to `Access-Control-Allow-Headers`.

Result:
- Cross-origin deployments using `VITE_API_URL` can send CSRF-protected tRPC mutations.

File:
- `server/_core/index.ts`

## Verification

Commands run:

```bash
corepack pnpm check
corepack pnpm test
corepack pnpm build
```

Results:
- Type check passed.
- Test suite passed: 9 files, 42 tests.
- Production build passed.

Known unchanged build warnings:
- `%VITE_ANALYTICS_ENDPOINT%` is not defined.
- `%VITE_ANALYTICS_WEBSITE_ID%` is not defined.
- Existing large bundle warning from Vite.

## Database Migration Status

No migrations were run.

Commands intentionally not executed:
- `corepack pnpm db:push`
- Any Drizzle migration command

## Remaining Non-Critical Follow-Up

The critical findings from the requested phase are addressed. Remaining hardening items from the audit still worth scheduling:

- Validate receipt image magic bytes, not only MIME/extension.
- Add signup and order creation rate limits.
- Add a persistent admin audit log.
- Sanitize admin report/order DTOs further to avoid returning raw rows.
- Add startup validation for all production env vars, not only `JWT_SECRET`.
- Resolve analytics placeholder build warnings.
