# Operations Runbook

This runbook covers event-day operation for the Festival Ticket Management System.

## Roles

- Customer: buys ticket, uploads bank transfer receipt, downloads QR ticket.
- Admin: manages events, reviews payment proofs, approves/rejects orders, monitors attendance.
- Staff: scans QR tickets at the gate.
- Technical operator: monitors deployment, database, storage, and Redis.

## Event Day Runbook

### Before gates open

1. Confirm production site loads.
2. Confirm admin can sign in.
3. Confirm staff scanner accounts can sign in.
4. Confirm `/scanner` opens on each gate device.
5. Confirm camera permission works on mobile and desktop scanner devices.
6. Scan one test valid ticket.
7. Scan the same test ticket again and confirm it shows already used.
8. Confirm attendance dashboard updates.
9. Confirm receipt upload and approval flow is working for any last-minute purchases.
10. Keep one admin logged in and available for payment proof review.

### During entry

1. Gate staff open `/scanner`.
2. Staff scan each customer's QR ticket.
3. If success:
   - Let attendee enter.
   - Confirm ticket number/event/check-in time on screen.
4. If already used:
   - Do not admit immediately.
   - Ask attendee to step aside.
   - Escalate to admin desk.
5. If invalid:
   - Confirm they are showing the official ticket page or printed QR.
   - Ask attendee to refresh/open ticket from their account.
   - Escalate if still invalid.
6. Admin monitors attendance dashboard every 10-15 minutes.

### After gates close

1. Export or screenshot attendance totals.
2. Record final counts:
   - Total tickets
   - Checked in
   - Remaining
   - Attendance percentage
3. Stop approving late receipts unless event policy allows late entry.
4. Review scan logs for invalid or repeated scans.
5. Back up the database.

## Admin Approval Workflow

Customer flow:

1. Customer creates an order.
2. Customer uploads bank transfer receipt.
3. Order becomes `PENDING_PAYMENT_VERIFICATION`.
4. Admin reviews the receipt in the admin order screen.

Approval steps:

1. Open admin orders/payment proofs.
2. Review:
   - buyer name/email
   - event
   - ticket type
   - quantity
   - total amount
   - receipt image
3. Verify bank transfer externally against the real bank account.
4. Click approve only when amount and payer are acceptable.
5. System marks payment paid, creates `FT-YYYY-000001` style tickets, creates QR images, and marks tickets `VALID`.
6. Customer can open/download their ticket.

Rejection steps:

1. Open the pending proof.
2. Click reject.
3. Enter a clear reason, for example:
   - wrong amount
   - unclear receipt
   - duplicate receipt
   - wrong bank account
4. Customer sees rejection reason and can upload again.

Approval rules:
- Never approve from screenshot alone if bank record cannot be matched.
- Reject duplicate or suspicious receipts.
- Escalate high-value or unclear payments to the finance lead.

## QR Scanner Workflow

Setup:

1. Sign in with a `staff` or `admin` account.
2. Open `/scanner`.
3. Grant camera permission.
4. Keep device battery above 50% or plugged in.
5. Keep Wi-Fi or mobile data stable.

Scanning:

1. Point camera at the QR code.
2. Wait for scan result.
3. On success, admit attendee.
4. On already used, send attendee to admin desk.
5. On invalid, ask attendee to open the official ticket page and retry.

Manual fallback:

1. If camera fails, use manual token/code input if available on the scanner page.
2. If scanner device fails completely, switch to another staff device.
3. If network fails, pause entry or move to a network with backend access. Do not manually admit large groups without recording exceptions.

Scanner security:
- Staff accounts must not be shared publicly.
- Log out scanner devices after event.
- Report lost scanner devices immediately.

## Attendance Monitoring

Admin dashboard metrics:

- Total tickets
- Checked in
- Remaining tickets
- Attendance percentage

Monitoring cadence:

- 30 minutes before opening: verify baseline.
- First 30 minutes after opening: check every 5 minutes.
- Main entry window: check every 10-15 minutes.
- After peak: check every 30 minutes.
- Closing: record final totals.

Signals to investigate:

- sudden spike in invalid scans
- many already-used scans at one gate
- attendance count not changing while gate is active
- scanner staff reporting success but dashboard not updating
- checked-in count exceeds expected gate throughput

## Incident Response

### Invalid ticket report

1. Ask attendee to show official ticket page.
2. Confirm they are signed in to the correct account.
3. Search the ticket/order in admin.
4. Check status:
   - `VALID`: retry scanner.
   - `USED`: check scan log time and gate.
   - `CANCELLED` or `EXPIRED`: do not admit without admin override policy.
5. Record attendee name, ticket number, issue, and resolution.

### Already-used ticket dispute

1. Move attendee out of the entry line.
2. Check scan log.
3. Compare check-in time with attendee arrival claim.
4. Ask for ID or payment/order confirmation if event policy requires it.
5. Admin decides whether to deny entry or issue a manual exception.
6. Record the decision.

### Admin account compromise

1. Change affected user role to `user` in DB.
2. Rotate `JWT_SECRET` if session compromise is suspected.
3. Review recent admin approvals/cancellations.
4. Review issued tickets after suspicious admin activity.
5. Restore from backup only if data integrity is compromised.

### Storage access issue

Symptoms:
- Receipt images do not open for admins.
- QR images do not load for ticket owners.

Checks:
1. Confirm `BUILT_IN_FORGE_API_URL`.
2. Confirm `BUILT_IN_FORGE_API_KEY`.
3. Confirm user is signed in with correct role.
4. Confirm stored path begins with expected prefix:
   - `payment-proofs/`
   - `qr-tickets/`

### Rate limiting issue

Symptoms:
- Users see "Too many requests".
- Production shows rate-limit configuration errors.

Checks:
1. Confirm `UPSTASH_REDIS_REST_URL`.
2. Confirm `UPSTASH_REDIS_REST_TOKEN`.
3. Confirm Upstash service is healthy.
4. Identify whether traffic spike is legitimate or abusive.

### Database issue

Symptoms:
- Catalog empty.
- Orders fail.
- Approvals fail.
- Scanner cannot check in.

Checks:
1. Confirm TiDB cluster is online.
2. Confirm `DATABASE_URL`.
3. Confirm migrations are applied.
4. Confirm connection limits are not exhausted.
5. Pause payment approvals if writes are failing.

## Backup Procedure

Before event:

1. Create a TiDB backup/snapshot.
2. Export current event, ticket type, order, payment, ticket, and attendance tables if available.
3. Confirm backup restore point is visible in TiDB Cloud.

During event:

1. Do not run migrations.
2. Avoid manual DB edits unless part of incident response.
3. Record any manual changes in an incident log.

After event:

1. Create a final database backup.
2. Export attendance data.
3. Export scan logs.
4. Store exports in the event operations folder.

Minimum backup targets:

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

## Festival Opening Checklist

Technical:

- [ ] Production deployment is on the expected version.
- [ ] `DATABASE_URL` points to production TiDB.
- [ ] `JWT_SECRET` is configured.
- [ ] `FRONTEND_URL` and `CORS_ORIGINS` are correct.
- [ ] Upstash Redis env vars are configured.
- [ ] Storage env vars are configured.
- [ ] `corepack pnpm check` passed in CI or release validation.
- [ ] `corepack pnpm test` passed in CI or release validation.
- [ ] `corepack pnpm build` passed in CI or release validation.

Admin:

- [ ] Admin account can sign in.
- [ ] Staff scanner accounts can sign in.
- [ ] Events and ticket types are correct.
- [ ] Payment proof list loads.
- [ ] Attendance dashboard loads.

Scanner:

- [ ] Every gate device can open `/scanner`.
- [ ] Camera permission works.
- [ ] Test ticket scan succeeds.
- [ ] Duplicate scan shows already used.
- [ ] Staff know escalation process.

Finance:

- [ ] Bank account access is available.
- [ ] Receipt verification owner is assigned.
- [ ] Rejection reason policy is agreed.
- [ ] Late payment policy is agreed.

## Festival Closing Checklist

Gate:

- [ ] Stop scanner operations.
- [ ] Staff log out of scanner devices.
- [ ] Collect any manual exception notes.

Admin:

- [ ] Record total tickets.
- [ ] Record checked-in count.
- [ ] Record remaining count.
- [ ] Record attendance percentage.
- [ ] Review invalid and already-used scan logs.
- [ ] Stop approving receipts unless explicitly allowed.

Data:

- [ ] Create final TiDB backup.
- [ ] Export attendance records.
- [ ] Export scan logs.
- [ ] Save incident log.
- [ ] Save final revenue/order summary.

Post-event:

- [ ] Remove temporary staff roles if needed.
- [ ] Rotate credentials if shared operationally.
- [ ] Review incidents and update this runbook.
