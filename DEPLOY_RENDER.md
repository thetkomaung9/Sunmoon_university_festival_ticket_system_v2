# Render Deployment Guide

This project is a single Node web service:

- Frontend: Vite + React
- Backend: Express + tRPC
- Database: TiDB Cloud via MySQL protocol
- Production frontend output: `dist/public`
- Production server entry: `dist/index.js`

## Render Settings

Use the repository root as the Render root directory.

| Setting | Value |
| --- | --- |
| Service type | Web Service |
| Runtime | Node |
| Root Directory | `.` |
| Build Command | `corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm build` |
| Start Command | `corepack pnpm start` |
| Health Check Path | `/` |

The included `render.yaml` contains these settings and can be used as a Render Blueprint.

## Required Environment Variables

Set these in Render before the first deploy:

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | Yes | Set to `production`. |
| `DATABASE_URL` | Yes | TiDB Cloud MySQL connection string. Keep `sslaccept=strict` or equivalent TLS settings. |
| `JWT_SECRET` | Yes | Strong random secret used for admin sessions and QR ticket token signing. |
| `OWNER_OPEN_ID` | Yes | Admin owner identity used by the app. |
| `FRONTEND_URL` | Yes | Your Render service URL, for example `https://sunmoon-ticketing.onrender.com`. |
| `CORS_ORIGINS` | Yes | Same value as `FRONTEND_URL` for single-origin Render deployment. |
| `BUILT_IN_FORGE_API_URL` | Yes | Required in production for uploaded payment receipts and generated QR images. |
| `BUILT_IN_FORGE_API_KEY` | Yes | Required in production for uploaded payment receipts and generated QR images. |
| `UPSTASH_REDIS_REST_URL` | Recommended | Shared production rate limiting for ticket/order lookup. |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended | Shared production rate limiting for ticket/order lookup. |
| `ALLOW_IN_MEMORY_RATE_LIMIT` | Yes | Set to `true` only for a single Render web instance when Upstash is not configured. |

Usually leave `VITE_API_URL` unset on Render. The frontend and API are served from the same origin, and the client will call `/api/trpc`.

For a single Render free web service, `ALLOW_IN_MEMORY_RATE_LIMIT=true` keeps buyer ticket lookup working without Upstash. Use Upstash Redis instead before scaling beyond one instance because in-memory limits are per process.

OAuth variables such as `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, and `VITE_APP_ID` are only needed if you enable the OAuth login flow. Admin email/password login does not require them.

## TiDB Cloud

1. Copy the TiDB Cloud connection string into Render as `DATABASE_URL`.
2. Confirm the URL contains TLS configuration, such as `sslaccept=strict`.
3. Allow Render outbound access in TiDB Cloud networking settings if IP allowlisting is enabled.
4. Run migrations before production traffic if schema changes are pending:

```bash
corepack pnpm db:push
```

## Deployment Steps

1. Push this repository to GitHub.
2. In Render, choose **New +** then **Blueprint** if using `render.yaml`, or choose **Web Service** for manual setup.
3. Select the repository.
4. Confirm:
   - Root Directory: `.`
   - Build Command: `corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm build`
   - Start Command: `corepack pnpm start`
   - Health Check Path: `/`
5. Add all required environment variables from the table above.
6. Create the service.
7. After Render gives you the service URL, update:
   - `FRONTEND_URL`
   - `CORS_ORIGINS`
8. Trigger a manual deploy.
9. Visit the Render URL and confirm the app loads.
10. Confirm the API is reachable with the tRPC health query:

```bash
curl 'https://YOUR_RENDER_URL/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A1%7D%7D'
```

Expected response includes `"ok":true`.

## Local Verification Commands

Run these before deploying:

```bash
corepack pnpm check
corepack pnpm build
NODE_ENV=production PORT=3100 node dist/index.js
```

Then in another terminal:

```bash
curl -I http://localhost:3100/
curl 'http://localhost:3100/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A1%7D%7D'
```

The root page should return `200`, and the health query should include `"ok":true`.

## Notes

- Do not configure Render as a static site. The Express/tRPC backend must run as a Node web service.
- The production Express server serves Vite files from `dist/public`.
- Receipt uploads and QR code images require the Forge storage environment variables in production.
