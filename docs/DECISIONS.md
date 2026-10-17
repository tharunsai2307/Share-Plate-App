# SharePlate — Architecture Decision Records

**Version:** 0.1.0
**Date:** 2026-10-16

---

## ADR-001: Supabase as Backend Platform

**Status:** Accepted

**Context:** Need a managed backend supporting auth, database, RLS, storage, realtime, and edge functions without building infrastructure from scratch.

**Decision:** Use Supabase (PostgreSQL + Auth + RLS + Storage + Realtime + Edge Functions).

**Consequences:**
- Positive: Rapid development, RLS enforced at DB layer, built-in auth, realtime out of the box.
- Negative: Vendor dependency. Supabase Edge Functions have Deno runtime constraints. Cold starts for Edge Functions possible.
- Mitigation: Architecture uses Edge Functions only for privileged operations; most reads are direct Supabase client calls through RLS.

---

## ADR-002: Reservation Atomicity via Edge Function + PostgreSQL Transaction

**Status:** Accepted

**Context:** Two concurrent NGO users must not both successfully reserve the last portions of a listing.

**Decision:** Reservation creation is handled exclusively by an Edge Function that runs a SERIALIZABLE PostgreSQL transaction with SELECT FOR UPDATE on the listing row.

**Consequences:**
- Positive: Guaranteed atomicity, no race condition.
- Negative: Reservation path requires Edge Function invocation (slight latency vs direct Supabase insert).
- Rejected alternative: Optimistic locking via check constraint only — insufficient for concurrent reads.

---

## ADR-003: NUMERIC(12,3) for Quantities

**Status:** Accepted

**Context:** Floating-point arithmetic on food quantities can produce incorrect results (e.g., 10 * 0.1 != 1.0 in IEEE 754).

**Decision:** All quantity columns use NUMERIC(12,3) (exact decimal, 3 decimal places, max 999,999,999.999).

**Consequences:**
- Positive: Exact arithmetic, no rounding errors in quantity invariant checks.
- Negative: Slight storage overhead vs FLOAT. Acceptable.

---

## ADR-004: 6-Digit Numeric OTP for Handover Verification

**Status:** Accepted

**Context:** Need a simple, low-friction verification mechanism that works without QR scanner hardware.

**Decision:** Server generates a 6-digit numeric OTP. Client shows it to donor/volunteer. Recipient enters it. OTP is hashed (bcrypt) before storage, single-use, 30-minute TTL, 5 attempt limit.

**Consequences:**
- Positive: Works on any phone, no QR hardware needed, simple UX.
- Negative: Subject to shoulder-surfing. Not suitable as sole proof of identity for high-value transfers.
- Future: QR code as alternative input method may be added in Phase E.

---

## ADR-005: Immediate Reservation Confirmation (No Donor Approval)

**Status:** Accepted (MVP)

**Context:** Requiring donor to approve each reservation before it is confirmed adds UX friction and delays the pickup workflow.

**Decision:** For MVP, reservations are immediately confirmed by the server if the organization is verified and quantity is available. Donors configure pickup windows in advance.

**Consequences:**
- Positive: Simpler NGO experience, faster pickup coordination.
- Negative: Donors lose per-reservation control. Offset by donor ability to cancel listings.
- Revisit: In Phase E, add optional donor-approval mode per listing.

---

## ADR-006: Monorepo with npm Workspaces

**Status:** Accepted

**Context:** Mobile and web admin share domain types and validation schemas.

**Decision:** Single repository with npm workspaces: apps/mobile, apps/admin, packages/shared. No Turborepo or Nx in Phase A.

**Consequences:**
- Positive: Single type system, one CI pipeline, shared domain logic.
- Negative: Requires care to avoid importing platform-specific modules across packages.
- Constraint: packages/shared must never import react-native or Next.js-specific modules.

---

## ADR-007: Strict TypeScript Everywhere

**Status:** Accepted

**Context:** Prevents class of runtime bugs from type mismatches; makes refactoring safer.

**Decision:** strict: true in all tsconfig files. No `any` casts without documented justification. ESLint @typescript-eslint/no-explicit-any enabled.

**Consequences:**
- Positive: Fewer bugs, safer refactors, better IDE support.
- Negative: More initial typing work for third-party integrations.

---

## ADR-008: is_demo Flag on All Data Tables

**Status:** Accepted

**Context:** Seed data must not contaminate real impact metrics.

**Decision:** All data tables include is_demo BOOLEAN DEFAULT false. All impact metric queries add WHERE is_demo = false.

**Consequences:**
- Positive: Safe mixed environment for demos; real metrics always accurate.
- Negative: Every metric query must include the filter. Enforced by code review.

---

## ADR-009: Append-Only Audit Log

**Status:** Accepted

**Context:** Audit integrity requires that historical records cannot be altered.

**Decision:** audit_logs table has RLS: UPDATE PROHIBITED, DELETE PROHIBITED. INSERT only via Edge Functions and triggers. Corrections append new records with reference to corrected record.

**Consequences:**
- Positive: Non-repudiable audit trail.
- Negative: Audit table grows indefinitely — requires archival strategy (documented in DEPLOYMENT.md).

---

## ADR-010: Expo EAS Update for OTA

**Status:** Accepted

**Context:** Bug fixes and content updates should not require a full store review cycle.

**Decision:** Use Expo EAS Update with explicit channels (development, preview, production). OTA updates only for JavaScript/asset changes. Native changes require new binary.

**Consequences:**
- Positive: Fast bug fixes, controlled rollout.
- Negative: Cannot update native code via OTA. Must document incompatible change requirements.
- Constraint: Production channel updates require explicit authorization and prior preview testing.
