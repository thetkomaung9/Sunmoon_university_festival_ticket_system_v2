# Deployment Guide

This guide covers production deployment for the Sunmoon University Festival Ticket Management System.

## Environment Variables

Required server variables:

```bash
NODE_ENV=production
DATABASE_URL=mysql://USER:PASSWORD@HOST:PORT/DATABASE?sslaccept=strict
JWT_SECRET=replace-with-a-long-random-secret
FRONTEND_URL=https://your-production-domain.example
CORS_ORIGINS=https://your-production-domain.example
BUILT_IN_FORGE_API_URL=https://...
BUILT_IN_FORGE_API_KEY=...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

Required auth variables:

```bash
VITE_APP_ID=...
OAUTH_SERVER_URL=...
VITE_OAUTH_PORTAL_URL=...
OWNER_OPEN_ID=...
```

Optional frontend variables:

```bash
VITE_API_URL=https://your-api-domain.example
VITE_ANALYTICS_ENDPOINT=https://...
VITE_ANALYTICS_WEBSITE_ID=...
```

Notes:
- `JWT_SECRET` must be non-empty in production.
- `FRONTEND_URL` and `CORS_ORIGINS` must match the deployed browser origin.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are required in production because rate limiting fails closed without Redis.
- Do not commit `.env` files.

## TiDB Cloud Setup

1. Create a TiDB Cloud cluster.
2. Create a production database, for example `sunmoon_ticketing`.
3. Create an application user with access only to this database.
4. Allowlist the deployment platform egress IPs if TiDB network access is restricted.
5. Copy the MySQL-compatible connection string into `DATABASE_URL`.
6. Confirm SSL settings required by TiDB Cloud are present in the connection string.

Recommended checks:

```bash
corepack pnpm check
corepack pnpm test
corepack pnpm build
```

## Migration Order

Run migrations in chronological order. The repository currently contains:

1. `drizzle/0000_silky_wolfpack.sql`
2. `drizzle/0001_freezing_johnny_blaze.sql`
3. `drizzle/0002_seed_sunmoon_catalog.sql`
4. `drizzle/0003_add_password_auth.sql`
5. `drizzle/0004_add_payments_attendance.sql`
6. `drizzle/0005_payment_proof_approval.sql`

The project migration command is:

```bash
corepack pnpm db:push
```

That command runs `scripts/migrate.mjs`, which calls `drizzle-kit migrate` when `DATABASE_URL` is set.

Production migration procedure:

1. Back up the production database.
2. Set `DATABASE_URL` to the production TiDB connection string.
3. Run migrations once from a controlled environment.
4. Verify required tables exist:
   - `users`
   - `event_categories`
   - `events`
   - `ticket_types`
   - `orders`
   - `payments`
   - `payment_proofs`
   - `tickets`
   - `payment_logs`
   - `attendance`
   - `scan_logs`
5. Do not run migrations from multiple deployment instances at the same time.

## Admin User Creation

The system supports password auth and role-based access through `users.role`.

Recommended production approach:

1. Deploy with `OWNER_OPEN_ID` set to the intended owner identity.
2. Sign up or sign in with the owner account.
3. Confirm the matching user exists in `users`.
4. Set the first admin role directly in the database if needed:

```sql
UPDATE users
SET role = 'admin'
WHERE email = 'admin@example.com';
```

Staff scanner users need:

```sql
UPDATE users
SET role = 'staff'
WHERE email = 'scanner@example.com';
```

Roles:
- `user`: buyer/customer.
- `staff`: scanner access.
- `admin`: full admin dashboard and approval access.

## Upstash Redis Setup

1. Create an Upstash Redis database in the region closest to the app server.
2. Copy the REST URL and token.
3. Configure:

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Used for production rate limiting:
- Login: 10/minute per IP.
- Payment proof upload: 10/minute per user.
- Order lookup: 30/minute per IP.
- Ticket lookup: 30/minute per IP.
- Scanner verify/check-in: 60/minute per staff/admin user.

If these variables are missing in production, protected operations fail closed.

## Storage Setup

The app uses the existing Forge/Manus storage integration.

Required variables:

```bash
BUILT_IN_FORGE_API_URL=...
BUILT_IN_FORGE_API_KEY=...
```

Storage paths:
- Payment receipts: `payment-proofs/*`
- QR ticket images: `qr-tickets/*`
- Public catalog/category images: existing public asset paths

Access rules:
- `payment-proofs/*`: admin only.
- `qr-tickets/*`: ticket owner, staff, or admin.
- Other storage paths remain public.

Before launch:
1. Upload a test receipt.
2. Confirm an admin can open the receipt.
3. Confirm a non-admin cannot open another user's receipt.
4. Approve a test payment.
5. Confirm the customer can open their QR ticket image.
6. Confirm unrelated users cannot open that QR image.

## Production Deployment Steps

1. Prepare infrastructure:
   - TiDB Cloud database.
   - Upstash Redis database.
   - Forge/Manus storage credentials.
   - Production domain.

2. Configure environment variables in the deployment platform.

3. Install dependencies:

```bash
corepack enable
corepack pnpm install --frozen-lockfile
```

4. Validate locally or in CI:

```bash
corepack pnpm check
corepack pnpm test
corepack pnpm build
```

5. Run database migrations:

```bash
corepack pnpm db:push
```

6. Start production server:

```bash
corepack pnpm start
```

7. Smoke test:
   - Public homepage loads.
   - Sign in works.
   - Admin dashboard loads for admin account.
   - Event catalog loads from DB.
   - Customer order can be created.
   - Receipt upload moves order to `PENDING_PAYMENT_VERIFICATION`.
   - Admin approval issues `FT-YYYY-000001` style tickets.
   - Ticket page shows QR image.
   - Scanner can check in a valid ticket once.
   - Second scan shows already used.

## Vercel Note

`vercel.json` currently builds `dist/public` as a static output. The Express/tRPC server also needs a Node runtime deployment. For production, deploy the full Node server on a platform that runs:

```bash
corepack pnpm build
corepack pnpm start
```

If frontend and backend are split across domains, set `VITE_API_URL`, `FRONTEND_URL`, and `CORS_ORIGINS` correctly.

## Rollback Procedure

Application rollback:

1. Identify the last known good commit/build.
2. Redeploy that build with the same production environment variables.
3. Confirm health endpoint:

```text
/api/trpc/system.health
```

4. Run smoke tests for login, admin dashboard, ticket lookup, and scanner.

Database rollback:

1. Prefer forward fixes for schema issues when possible.
2. If rollback is required, restore from the latest verified TiDB backup.
3. Do not manually delete issued tickets, attendance, or payment records without exporting them first.
4. After restore, verify:
   - order counts
   - payment proof counts
   - ticket counts
   - attendance counts

Emergency disablement:

1. Temporarily remove admin access by changing affected users' role to `user`.
2. Disable public buying by setting event or ticket type status to hidden/closed from admin or direct DB update.
3. Keep scanner access available during event entry unless fraud is actively occurring.
