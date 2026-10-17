# SharePlate — Architecture

**Version:** 0.1.0
**Date:** 2026-10-16

---

## Repository Layout

```
shareplate/                         (workspace root)
  apps/
    mobile/                         # Expo + React Native + TypeScript
    admin/                          # Next.js 15 App Router + TypeScript
  packages/
    shared/                         # Domain types, Zod schemas, business rules
  supabase/
    migrations/                     # Versioned SQL migrations (timestamped)
    functions/                      # Supabase Edge Functions (Deno/TypeScript)
    seed/                           # Demo/test seed data (clearly marked)
    config.toml                     # Supabase project configuration
  docs/                             # Architecture and engineering docs
  .github/
    workflows/                      # CI pipelines
  .env.example                      # Placeholder environment variables
```

---

## Technology Stack

### Mobile (apps/mobile)

| Concern | Technology |
|---------|-----------|
| Framework | React Native + Expo SDK 52 |
| Language | TypeScript (strict) |
| Routing | Expo Router v4 |
| Forms | React Hook Form + Zod |
| Server state | TanStack Query v5 |
| Auth client | @supabase/supabase-js |
| Realtime | Supabase Realtime (authorized channels) |
| Notifications | Expo Notifications |
| OTA updates | Expo EAS Update |
| Storage | Supabase Storage (signed URLs) |
| Testing | Jest + React Native Testing Library |
| E2E | Detox (where native build available) |

### Web Admin (apps/admin)

| Concern | Technology |
|---------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Vanilla CSS + CSS Modules |
| Auth | @supabase/ssr (server-side session) |
| Server state | TanStack Query v5 (client) + server components |
| Forms | React Hook Form + Zod |
| Testing | Jest + React Testing Library + Playwright |

### Backend

| Concern | Technology |
|---------|-----------|
| Database | PostgreSQL (via Supabase) |
| Auth | Supabase Auth (email/password + OAuth) |
| Authorization | Row Level Security (RLS) |
| Storage | Supabase Storage (private buckets) |
| Realtime | Supabase Realtime (row-level filtering) |
| Business logic | Supabase Edge Functions (Deno TypeScript) |
| Migrations | Supabase CLI versioned migrations |

### Shared Package (packages/shared)

- Domain type definitions (TypeScript interfaces)
- Zod validation schemas
- Status enum definitions
- Business rule constants (max quantities, expiry windows)
- Utility functions with no platform-specific imports

---

## Authorization Architecture

```
Client (Mobile / Web)
  |
  | JWT (Supabase Auth)
  v
Supabase API Gateway
  |
  | RLS policies evaluated per request
  v
PostgreSQL
  |
  | Privileged operations via service-role
  v
Edge Functions (server-side only, service-role key NEVER in client bundle)
```

### Trust Hierarchy

1. **Service-role key**: Only in Edge Functions / server-side admin API. Never in client bundle.
2. **Anon key**: Public — only used for auth flow. RLS prevents data access without auth.
3. **User JWT**: Passed by client. RLS enforces per-row access.
4. **Admin role**: Database-level `app_role = 'admin'` checked inside RLS and Edge Functions.

---

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Reservation atomicity | PostgreSQL transaction in Edge Function with SELECT FOR UPDATE | Prevents double-booking |
| Handover OTP | 6-digit code, hashed server-side, 30-min TTL | Simple UX, replay-safe |
| Quantity type | NUMERIC(12,3) | Exact decimal arithmetic, no floating-point errors |
| Timestamps | TIMESTAMPTZ (UTC) | Correct DST handling |
| Audit log | Append-only table, no UPDATE/DELETE for clients | Non-repudiable history |
| Impact metrics | Computed from authoritative records | No fabricated counters |
| OTA updates | EAS Update with explicit channels | Controlled release |
| Monorepo | Yes (apps + packages) | Safe type sharing, single CI |

---

## Data Flow: Reservation (Critical Path)

```
NGO Mobile App
  1. POST /functions/v1/create-reservation
     { listing_id, quantity, unit, idempotency_key }
     Authorization: Bearer <user_jwt>

Edge Function: create-reservation
  2. Verify JWT -> extract user_id
  3. Load profile -> verify org membership + org verified
  4. BEGIN TRANSACTION (SERIALIZABLE)
  5. SELECT ... FROM food_listings WHERE id=? FOR UPDATE
  6. Check: listing status = published/partially_reserved
  7. Check: quantity_offered - quantity_reserved >= requested
  8. Check: pickup_window_end > NOW()
  9. INSERT INTO reservations (...)
  10. UPDATE food_listings SET quantity_reserved += quantity
  11. UPDATE listing status if fully_reserved
  12. INSERT INTO audit_logs (...)
  13. COMMIT
  14. RETURN { reservation_id, status: 'confirmed' }

Mobile App
  15. Invalidate listing + reservations queries
  16. Show confirmed state
```

---

## Realtime Subscriptions

| Channel | Filter | Audience |
|---------|--------|----------|
| listing_updates | listing_id | Donor (own listings) |
| reservation_updates | reservation_id | NGO (own reservations) |
| pickup_updates | assignment_id | Volunteer (own assignments) |
| admin_queue | organization_id | Admin only |

All channels filtered by RLS. No broadcast to unauthorized users.

---

## Environment Configuration

See `.env.example` for all required variables. Validated at startup — app refuses to start with missing critical config.

| Variable | Used In | Purpose |
|----------|---------|---------|
| EXPO_PUBLIC_SUPABASE_URL | Mobile, Web | Supabase project URL |
| EXPO_PUBLIC_SUPABASE_ANON_KEY | Mobile, Web | Public anon key |
| SUPABASE_SERVICE_ROLE_KEY | Edge Functions only | Privileged operations |
| NEXT_PUBLIC_SUPABASE_URL | Web admin | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Web admin | Public anon key |
| SUPABASE_URL | Edge Functions | Internal URL |
| SUPABASE_DB_URL | CI/migrations | Direct DB connection |
| EAS_PROJECT_ID | Mobile CI | Expo app ID |
