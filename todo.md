# Sunmoon University Myanmar Team — Event Ticketing TODO

## Foundation
- [x] Navy/blue academic theme tokens (light theme, Sunmoon-branded)
- [x] Bilingual (Myanmar/English) labels in shared constants
- [x] Database schema: event_categories, events, ticket_types, orders, tickets, scan_logs
- [x] Seed initial categories (Thadingyut, Thingyan, Cultural Night) and 5 demo events

## Backend (tRPC)
- [x] categories router (public list / admin CRUD)
- [x] events router (public list/detail by category, admin CRUD)
- [x] ticketTypes router (admin CRUD with stock)
- [x] orders router (createPending, getByMerchantUid)
- [x] payments webhook flow updating order to PAID server-side
- [x] tickets router (getByCode for buyer view, signed token verification)
- [x] scanner router (verify QR, check-in, scan log) — staff/admin only
- [x] admin router (orders list, attendance report, CSV export, resend, cancel/refund)
- [x] adminProcedure + staffProcedure RBAC helpers
- [x] Signed QR token (HMAC) using JWT_SECRET, token hash stored in DB
- [x] Owner notifications on PAID and on cancel/refund

## Frontend (public)
- [x] Top navigation header with bilingual links + Sunmoon Myanmar Team branding
- [x] Home (hero, upcoming events, category showcase, footer)
- [x] Categories listing page
- [x] Events list page (filter by category)
- [x] Event detail page (ticket types + buyer info form)
- [x] Checkout / mock payment confirmation page
- [x] Buyer ticket view page (QR + status)

## Frontend (admin/staff)
- [x] Staff scanner page (manual token input + verify/check-in)
- [x] Admin dashboard layout with sidebar
- [x] Admin: Categories management
- [x] Admin: Events management (with ticket types)
- [x] Admin: Orders list (resend, cancel, refund)
- [x] Admin: Attendance report + CSV export

## Auth
- [x] Manus OAuth integrated (template default)
- [x] role enum extended to user/staff/admin
- [x] Protected routes for /admin and /scanner

## Tests
- [x] vitest test for QR signing / verification
- [x] auth.logout.test.ts kept passing

## Polish
- [x] Mobile responsive (sticky header, mobile drawer, responsive grids)
- [x] Status badges with proper colors (VALID/USED/CANCELLED/EXPIRED)
- [x] Loading & empty states throughout
