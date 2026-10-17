-- SharePlate Migration 001: Initial Schema
-- Creates all core tables with constraints, indexes, and RLS scaffolding.
-- Apply with: supabase db push
-- Date: 2026-10-16

-- ─── Extensions ───────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Profiles ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 200),
  phone           TEXT CHECK (phone IS NULL OR char_length(phone) BETWEEN 10 AND 15),
  avatar_url      TEXT,
  app_role        TEXT NOT NULL DEFAULT 'user'
                  CHECK (app_role IN ('user', 'volunteer', 'admin')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  suspended_at    TIMESTAMPTZ,
  suspension_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'Application-level user profiles. Extends auth.users.';
COMMENT ON COLUMN public.profiles.app_role IS 'Platform-level role. NOT the same as org membership role.';

-- ─── Organizations ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 200),
  org_type            TEXT NOT NULL CHECK (org_type IN ('donor', 'recipient', 'both')),
  description         TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
  address_line1       TEXT,
  address_line2       TEXT,
  city                TEXT NOT NULL CHECK (char_length(city) BETWEEN 1 AND 100),
  state               TEXT NOT NULL CHECK (char_length(state) BETWEEN 1 AND 100),
  pincode             TEXT CHECK (pincode IS NULL OR pincode ~ '^\d{6}$'),
  country             TEXT NOT NULL DEFAULT 'IN',
  latitude            NUMERIC(9,6) CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90)),
  longitude           NUMERIC(9,6) CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180)),
  phone               TEXT,
  email               TEXT,
  website             TEXT,
  fssai_number        TEXT,
  registration_number TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
                      CHECK (verification_status IN ('unverified','pending','verified','rejected','suspended')),
  verified_at         TIMESTAMPTZ,
  verified_by         UUID REFERENCES public.profiles(id),
  suspended_at        TIMESTAMPTZ,
  suspension_reason   TEXT,
  is_demo             BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.organizations IS 'Donor and recipient organizations. Must be verified before food operations.';
COMMENT ON COLUMN public.organizations.is_demo IS 'True for seed/demo data. Excluded from real impact metrics.';

-- ─── Organization Members ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_role     TEXT NOT NULL DEFAULT 'member'
                  CHECK (member_role IN ('owner', 'manager', 'member')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

-- ─── Verification Applications ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.verification_applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  submitted_by    UUID NOT NULL REFERENCES public.profiles(id),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','under_review','approved','rejected')),
  documents       JSONB NOT NULL DEFAULT '[]'::JSONB,
  notes           TEXT,
  reviewer_id     UUID REFERENCES public.profiles(id),
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Food Listings ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.food_listings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_org_id          UUID NOT NULL REFERENCES public.organizations(id),
  created_by            UUID NOT NULL REFERENCES public.profiles(id),
  title                 TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  description           TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
  category              TEXT NOT NULL
                        CHECK (category IN ('cooked_meal','bakery','produce','dairy','packaged','beverage','other')),
  dietary_flags         TEXT[] NOT NULL DEFAULT '{}',
  quantity_offered      NUMERIC(12,3) NOT NULL CHECK (quantity_offered > 0),
  quantity_reserved     NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  quantity_collected    NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (quantity_collected >= 0),
  quantity_accepted     NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (quantity_accepted >= 0),
  quantity_distributed  NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (quantity_distributed >= 0),
  unit                  TEXT NOT NULL
                        CHECK (unit IN ('portions','kg','litres','boxes','items')),
  prepared_at           TIMESTAMPTZ NOT NULL,
  expires_at            TIMESTAMPTZ NOT NULL CHECK (expires_at > prepared_at),
  allergens             TEXT,
  storage_requirements  TEXT,
  transport_requirements TEXT,
  pickup_address        TEXT NOT NULL CHECK (char_length(pickup_address) BETWEEN 5 AND 500),
  pickup_latitude       NUMERIC(9,6),
  pickup_longitude      NUMERIC(9,6),
  pickup_window_start   TIMESTAMPTZ NOT NULL,
  pickup_window_end     TIMESTAMPTZ NOT NULL CHECK (pickup_window_end > pickup_window_start),
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','published','partially_reserved','fully_reserved',
                                          'pickup_in_progress','completed','expired','cancelled','suspended')),
  published_at          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancellation_reason   TEXT,
  suspended_at          TIMESTAMPTZ,
  suspension_reason     TEXT,
  photos                TEXT[] NOT NULL DEFAULT '{}',
  contact_name          TEXT,
  contact_phone         TEXT,
  is_demo               BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Quantity invariants (allow tiny tolerance for float precision)
  CONSTRAINT qty_reserved_le_offered     CHECK (quantity_reserved   <= quantity_offered + 0.001),
  CONSTRAINT qty_collected_le_reserved   CHECK (quantity_collected  <= quantity_reserved + 0.001),
  CONSTRAINT qty_accepted_le_collected   CHECK (quantity_accepted   <= quantity_collected + 0.001),
  CONSTRAINT qty_distributed_le_accepted CHECK (quantity_distributed <= quantity_accepted + 0.001)
);

COMMENT ON TABLE public.food_listings IS 'Core food listing entity. quantity_* fields must satisfy invariants.';

-- ─── Reservations ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reservations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id          UUID NOT NULL REFERENCES public.food_listings(id),
  recipient_org_id    UUID NOT NULL REFERENCES public.organizations(id),
  reserved_by         UUID NOT NULL REFERENCES public.profiles(id),
  quantity_requested  NUMERIC(12,3) NOT NULL CHECK (quantity_requested > 0),
  unit                TEXT NOT NULL CHECK (unit IN ('portions','kg','litres','boxes','items')),
  status              TEXT NOT NULL DEFAULT 'confirmed'
                      CHECK (status IN ('pending','confirmed','cancelled','expired','completed','disputed')),
  idempotency_key     TEXT UNIQUE CHECK (idempotency_key IS NULL OR char_length(idempotency_key) <= 128),
  confirmed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pickup_deadline     TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancelled_by        UUID REFERENCES public.profiles(id),
  completed_at        TIMESTAMPTZ,
  is_demo             BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.reservations IS 'Confirmed reservations from NGOs. Created atomically via Edge Function.';
COMMENT ON COLUMN public.reservations.idempotency_key IS 'Client-provided key preventing duplicate reservations on retry.';

-- ─── Pickup Assignments ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pickup_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  UUID NOT NULL REFERENCES public.reservations(id),
  listing_id      UUID NOT NULL REFERENCES public.food_listings(id),
  volunteer_id    UUID REFERENCES public.profiles(id),
  status          TEXT NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled','in_progress','verified','completed','partial','failed')),
  scheduled_at    TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  arrived_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  notes           TEXT,
  is_demo         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Handoffs ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.handoffs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id           UUID NOT NULL REFERENCES public.pickup_assignments(id),
  reservation_id          UUID NOT NULL REFERENCES public.reservations(id),
  verification_code_hash  TEXT,          -- bcrypt hash of 6-digit OTP. Never plain-text.
  code_expires_at         TIMESTAMPTZ,
  code_attempts           INTEGER NOT NULL DEFAULT 0 CHECK (code_attempts >= 0),
  code_verified_at        TIMESTAMPTZ,
  quantity_confirmed      NUMERIC(12,3) CHECK (quantity_confirmed IS NULL OR quantity_confirmed >= 0),
  quantity_rejected       NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (quantity_rejected >= 0),
  rejection_reason        TEXT,
  donor_confirmed_by      UUID REFERENCES public.profiles(id),
  recipient_confirmed_by  UUID REFERENCES public.profiles(id),
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','code_sent','verified','completed','partial','failed','disputed')),
  donor_notes             TEXT,
  recipient_notes         TEXT,
  is_demo                 BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.handoffs.verification_code_hash IS 'bcrypt hash of OTP. Plaintext never stored.';

-- ─── Distribution Records ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.distribution_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id        UUID NOT NULL REFERENCES public.reservations(id),
  recipient_org_id      UUID NOT NULL REFERENCES public.organizations(id),
  recorded_by           UUID NOT NULL REFERENCES public.profiles(id),
  quantity_distributed  NUMERIC(12,3) NOT NULL CHECK (quantity_distributed > 0),
  unit                  TEXT NOT NULL CHECK (unit IN ('portions','kg','litres','boxes','items')),
  distributed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  beneficiary_count     INTEGER CHECK (beneficiary_count IS NULL OR beneficiary_count > 0),
  distribution_notes    TEXT,
  is_demo               BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Notifications ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  data            JSONB,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Device Tokens ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token         TEXT NOT NULL,
  platform      TEXT NOT NULL CHECK (platform IN ('ios','android','web')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

-- ─── Audit Logs ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES public.profiles(id),
  actor_role  TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- NO updated_at — append-only
);

COMMENT ON TABLE public.audit_logs IS 'Append-only audit log. UPDATE and DELETE are prohibited via RLS.';

-- ─── Safety Reports ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.safety_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        UUID REFERENCES public.food_listings(id),
  reservation_id    UUID REFERENCES public.reservations(id),
  reported_by       UUID NOT NULL REFERENCES public.profiles(id),
  report_type       TEXT NOT NULL
                    CHECK (report_type IN ('food_safety','quality','quantity_dispute','no_show','fraud','other')),
  description       TEXT NOT NULL CHECK (char_length(description) BETWEEN 20 AND 2000),
  status            TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','under_review','resolved','escalated')),
  resolved_by       UUID REFERENCES public.profiles(id),
  resolved_at       TIMESTAMPTZ,
  resolution_notes  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── App Config ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  value       JSONB NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES public.profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.app_config IS 'Admin-managed remote configuration. Values validated against schema in Edge Functions.';

-- ─── Indexes ──────────────────────────────────────────────────────────────────

-- Active listings discovery
CREATE INDEX IF NOT EXISTS idx_food_listings_status_window
  ON public.food_listings(status, pickup_window_end)
  WHERE status IN ('published','partially_reserved');

-- Listings by org (donor view)
CREATE INDEX IF NOT EXISTS idx_food_listings_donor_org
  ON public.food_listings(donor_org_id, status, created_at DESC);

-- Reservations by recipient org
CREATE INDEX IF NOT EXISTS idx_reservations_recipient_org
  ON public.reservations(recipient_org_id, status);

-- Reservations by listing (donor view)
CREATE INDEX IF NOT EXISTS idx_reservations_listing
  ON public.reservations(listing_id, status);

-- Pickup assignments by volunteer
CREATE INDEX IF NOT EXISTS idx_pickup_assignments_volunteer
  ON public.pickup_assignments(volunteer_id, status)
  WHERE volunteer_id IS NOT NULL;

-- Audit log by entity
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs(entity_type, entity_id, created_at DESC);

-- Audit log by actor
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON public.audit_logs(actor_id, created_at DESC);

-- Notifications by recipient
CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON public.notifications(recipient_id, is_read, created_at DESC);

-- Org verification queue
CREATE INDEX IF NOT EXISTS idx_orgs_verification_queue
  ON public.organizations(verification_status, created_at)
  WHERE verification_status IN ('pending','under_review');

-- Impact metric queries (non-demo records)
CREATE INDEX IF NOT EXISTS idx_food_listings_impact
  ON public.food_listings(status, is_demo, created_at)
  WHERE is_demo = false;

CREATE INDEX IF NOT EXISTS idx_distribution_records_impact
  ON public.distribution_records(recipient_org_id, is_demo, distributed_at)
  WHERE is_demo = false;

-- ─── Updated_at triggers ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'profiles','organizations','organization_members','verification_applications',
      'food_listings','reservations','pickup_assignments','handoffs',
      'distribution_records','device_tokens','safety_reports'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON public.%1$s;
       CREATE TRIGGER trg_%1$s_updated_at
       BEFORE UPDATE ON public.%1$s
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t
    );
  END LOOP;
END $$;

-- ─── Profile auto-creation ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
