# SharePlate — Security Model

**Version:** 0.1.0
**Date:** 2026-10-16

---

## Threat Model Summary

| Threat | Mitigation |
|--------|-----------|
| Unauthorized reservation | RLS + server-side org membership check |
| Double-booking | PostgreSQL SERIALIZABLE transaction + FOR UPDATE |
| Privilege escalation | app_role set only by admin Edge Function |
| Fake org verification | Manual admin review + audit log |
| OTP replay | Hashed storage + single-use + 30-min TTL + attempt limit |
| Service-role key exposure | Key only in Edge Functions, never in client bundle |
| SQL injection | Parameterized queries via supabase-js client |
| File abuse | Type/size validation + private buckets + signed URLs |
| Stale session | Supabase auto-refresh + server-side revocation |
| Admin bypass via client | All admin operations require server-side role check |

---

## Row Level Security Policies

RLS is enabled on every table. The following defines the policies.

### profiles
- SELECT: authenticated users can read their own profile; admin can read all.
- UPDATE: user can update their own profile (excluding app_role); admin can update any.
- INSERT: handled by trigger on auth.users insert.
- DELETE: admin only, with audit.

### organizations
- SELECT: authenticated users can read verified organizations; admin reads all.
- INSERT: authenticated user (owner role created automatically).
- UPDATE: organization owner/manager + admin.
- DELETE: admin only.

### organization_members
- SELECT: members of the same organization; admin.
- INSERT: org owner/manager or admin.
- UPDATE: org owner or admin.
- DELETE: org owner or admin.

### food_listings
- SELECT: authenticated users can read published/partially_reserved/fully_reserved listings; donor org members see own drafts; admin sees all.
- INSERT: verified donor org members only.
- UPDATE: listing creator or org manager (restricted fields post-publish); admin.
- DELETE: admin only (soft cancel preferred).

### reservations
- SELECT: recipient org members see own reservations; donor org members see reservations on their listings; volunteers see assigned reservations; admin sees all.
- INSERT: verified recipient org members via Edge Function only.
- UPDATE: Edge Function or admin only.
- DELETE: prohibited (cancel via status update).

### pickup_assignments
- SELECT: assigned volunteer; reservation parties; admin.
- INSERT: admin or authorized coordinator via Edge Function.
- UPDATE: volunteer (limited fields); admin.

### handoffs
- SELECT: assignment parties + admin.
- INSERT: Edge Function only.
- UPDATE: Edge Function only (OTP verification, quantity recording).

### distribution_records
- SELECT: recipient org members; admin.
- INSERT: verified recipient org members.
- UPDATE: admin only.

### audit_logs
- SELECT: admin only (actor can read own entries).
- INSERT: Edge Functions and database triggers only.
- UPDATE: PROHIBITED.
- DELETE: PROHIBITED.

### notifications
- SELECT: own notifications only.
- UPDATE: own notifications (mark read only).
- INSERT: Edge Functions only.
- DELETE: own, older than 90 days (admin can batch delete).

### device_tokens
- SELECT: own tokens only.
- INSERT: own tokens only.
- UPDATE: own tokens only.
- DELETE: own tokens; admin.

### safety_reports
- SELECT: reporter sees own; admin sees all.
- INSERT: authenticated users.
- UPDATE: admin only.

### app_config
- SELECT: authenticated users (non-sensitive keys); admin all.
- INSERT/UPDATE/DELETE: admin only.

---

## Authentication

- Provider: Supabase Auth (email/password; OAuth providers in Phase E)
- Session: JWT, refreshed automatically by supabase-js
- Revocation: profile.is_active = false checked in RLS; suspended accounts receive 403
- Password reset: Supabase built-in email flow
- Email verification: required before organization operations

---

## Secrets Management

| Secret | Location | Exposure |
|--------|----------|----------|
| SUPABASE_SERVICE_ROLE_KEY | Edge Function env only | Never in client |
| EXPO_PUBLIC_SUPABASE_ANON_KEY | Mobile bundle | Public — protected by RLS |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Web bundle | Public — protected by RLS |
| SUPABASE_DB_URL | CI secrets only | Never in app |
| EAS_PROJECT_ID | .env + CI | Non-sensitive |

`.env` files are in `.gitignore`. `.env.example` contains only placeholders.

---

## File Upload Security

- Allowed types: image/jpeg, image/png, image/webp (listings); application/pdf (verification docs)
- Max size: 5 MB per file
- Storage buckets:
  - `listing-photos`: public read (for published listings), authenticated write
  - `verification-docs`: private, signed URL only, admin access
- Server validates Content-Type from magic bytes, not only MIME header
- Storage paths include org_id to prevent cross-org overwrite

---

## Input Validation (Edge Functions)

All inputs validated with Zod before any database operation:
- IDs: UUID format
- Quantities: positive number, max 9999999.999
- Strings: trimmed, max length enforced
- Dates: ISO 8601, future dates where required
- Enums: matched against allowlist
- File paths: sanitized, no path traversal
- Idempotency keys: UUID or short string, max 128 chars

---

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| POST /auth/sign-in | 10/min per IP |
| POST /functions/create-reservation | 20/min per user |
| POST /functions/verify-handover | 5/min per handoff (OTP attempt limit) |
| POST /functions/submit-safety-report | 10/hour per user |

Implemented via Supabase Edge Function middleware.

---

## Audit Requirements

Audit events recorded for:
- Listing published, edited, cancelled, suspended
- Reservation created, cancelled, completed
- Handover OTP generated, verified, failed
- Distribution recorded
- Organization approved, rejected, suspended
- Admin action performed
- Safety report filed, resolved
- User suspended/unsuspended

Audit records: actor_id, actor_role, action, entity_type, entity_id, old_data, new_data, timestamp.

---

## Privacy

- Minimum necessary data collected
- Recipient organization identity not exposed to unrelated donors
- Beneficiary counts stored as aggregates only (no individual PII)
- Account deletion: Supabase auth delete + profile anonymization
- Data retention: operational data 3 years, audit logs 7 years (configurable)
- GDPR/IT Act 2000 compliance: documented assumption requiring legal review before launch
