-- ==============================================================================
-- SHAREPLATE: MASTER CLOUD SUPABASE DEPLOYMENT SCRIPT
-- Project: jlylvqbljwbwfqmisnfo (SharePlate Production)
-- Run this directly in: https://supabase.com/dashboard/project/jlylvqbljwbwfqmisnfo/sql/new
-- ==============================================================================

-- ─── STEP 1: EXTENSIONS ────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── STEP 2: CORE TABLES & CONSTRAINTS ─────────────────────────────────────────

-- 1. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name         TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 200),
  phone             TEXT CHECK (phone IS NULL OR char_length(phone) BETWEEN 10 AND 15),
  avatar_url        TEXT,
  app_role          TEXT NOT NULL DEFAULT 'user'
                    CHECK (app_role IN ('user', 'volunteer', 'admin')),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  suspended_at      TIMESTAMPTZ,
  suspension_reason TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Organizations
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

-- 3. Organization Members
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

-- 4. Verification Applications
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

-- 5. Food Listings
CREATE TABLE IF NOT EXISTS public.food_listings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  created_by            UUID NOT NULL REFERENCES public.profiles(id),
  title                 TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 150),
  description           TEXT CHECK (description IS NULL OR char_length(description) <= 1000),
  category              TEXT NOT NULL CHECK (category IN ('cooked_meal','bakery','produce','packaged','dairy')),
  dietary_flags         TEXT[] NOT NULL DEFAULT '{}'
                        CHECK (dietary_flags <@ ARRAY['vegetarian','vegan','halal','kosher','gluten_free','contains_nuts','dairy_free','non_veg']::TEXT[]),
  quantity_offered      NUMERIC(10,3) NOT NULL CHECK (quantity_offered > 0),
  quantity_reserved     NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  quantity_collected    NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (quantity_collected >= 0),
  quantity_accepted     NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (quantity_accepted >= 0),
  quantity_distributed  NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (quantity_distributed >= 0),
  unit                  TEXT NOT NULL CHECK (unit IN ('portions','kg','litres','boxes','items')),
  prepared_at           TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ NOT NULL,
  allergens             TEXT CHECK (allergens IS NULL OR char_length(allergens) <= 500),
  storage_requirements  TEXT NOT NULL CHECK (char_length(storage_requirements) BETWEEN 3 AND 500),
  transport_requirements TEXT NOT NULL CHECK (char_length(transport_requirements) BETWEEN 3 AND 500),
  pickup_address        TEXT NOT NULL CHECK (char_length(pickup_address) BETWEEN 5 AND 300),
  pickup_latitude       NUMERIC(9,6) CHECK (pickup_latitude IS NULL OR (pickup_latitude BETWEEN -90 AND 90)),
  pickup_longitude      NUMERIC(9,6) CHECK (pickup_longitude IS NULL OR (pickup_longitude BETWEEN -180 AND 180)),
  pickup_window_start   TIMESTAMPTZ NOT NULL,
  pickup_window_end     TIMESTAMPTZ NOT NULL,
  status                TEXT NOT NULL DEFAULT 'published'
                        CHECK (status IN ('draft','published','partially_reserved','fully_reserved','pickup_in_progress','completed','cancelled','expired','suspended')),
  cancellation_reason   TEXT,
  cancelled_at          TIMESTAMPTZ,
  suspension_reason     TEXT,
  suspended_at          TIMESTAMPTZ,
  published_at          TIMESTAMPTZ,
  is_demo               BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_fl_pickup_window CHECK (pickup_window_end > pickup_window_start),
  CONSTRAINT chk_fl_expiry_after_start CHECK (expires_at >= pickup_window_start),
  CONSTRAINT chk_fl_quantity_flow CHECK (
    quantity_reserved <= quantity_offered
    AND quantity_collected <= quantity_reserved
    AND quantity_accepted <= quantity_collected
    AND quantity_distributed <= quantity_accepted
  )
);

-- 6. Reservations
CREATE TABLE IF NOT EXISTS public.reservations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id          UUID NOT NULL REFERENCES public.food_listings(id) ON DELETE RESTRICT,
  recipient_org_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  reserved_by         UUID NOT NULL REFERENCES public.profiles(id),
  quantity_requested  NUMERIC(10,3) NOT NULL CHECK (quantity_requested > 0),
  unit                TEXT NOT NULL CHECK (unit IN ('portions','kg','litres','boxes','items')),
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','confirmed','pickup_in_progress','completed','cancelled','expired')),
  idempotency_key     TEXT NOT NULL UNIQUE,
  confirmed_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancelled_by        UUID REFERENCES public.profiles(id),
  completed_at        TIMESTAMPTZ,
  pickup_deadline     TIMESTAMPTZ,
  is_demo             BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Pickup Assignments
CREATE TABLE IF NOT EXISTS public.pickup_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  listing_id      UUID NOT NULL REFERENCES public.food_listings(id) ON DELETE RESTRICT,
  volunteer_id    UUID NOT NULL REFERENCES public.profiles(id),
  status          TEXT NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled','en_route_pickup','arrived_pickup','in_progress','en_route_delivery','arrived_delivery','completed','cancelled','failed')),
  scheduled_at    TIMESTAMPTZ NOT NULL,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  is_demo         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Handoffs
CREATE TABLE IF NOT EXISTS public.handoffs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id           UUID NOT NULL REFERENCES public.pickup_assignments(id) ON DELETE CASCADE,
  reservation_id          UUID NOT NULL REFERENCES public.reservations(id) ON DELETE RESTRICT,
  verification_code_hash  TEXT,
  code_expires_at         TIMESTAMPTZ,
  verified_at             TIMESTAMPTZ,
  verified_by             UUID REFERENCES public.profiles(id),
  quantity_confirmed      NUMERIC(10,3) CHECK (quantity_confirmed IS NULL OR quantity_confirmed > 0),
  status                  TEXT NOT NULL DEFAULT 'code_sent'
                          CHECK (status IN ('code_sent','verified','override_required','override_approved','failed','completed')),
  is_demo                 BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Distribution Records
CREATE TABLE IF NOT EXISTS public.distribution_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id        UUID NOT NULL REFERENCES public.reservations(id) ON DELETE RESTRICT,
  recipient_org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  recorded_by           UUID NOT NULL REFERENCES public.profiles(id),
  quantity_distributed  NUMERIC(10,3) NOT NULL CHECK (quantity_distributed > 0),
  unit                  TEXT NOT NULL CHECK (unit IN ('portions','kg','litres','boxes','items')),
  distributed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  beneficiary_count     INTEGER NOT NULL CHECK (beneficiary_count > 0),
  distribution_notes    TEXT NOT NULL CHECK (char_length(distribution_notes) BETWEEN 3 AND 500),
  is_demo               BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_read       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Device Tokens
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL CHECK (platform IN ('ios','android','web')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

-- 12. Safety Reports
CREATE TABLE IF NOT EXISTS public.safety_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID REFERENCES public.food_listings(id) ON DELETE SET NULL,
  reservation_id  UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  reported_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  report_type     TEXT NOT NULL CHECK (report_type IN ('quality','temperature','packaging','hygiene','other')),
  description     TEXT NOT NULL CHECK (char_length(description) BETWEEN 5 AND 1000),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','dismissed')),
  action_taken    TEXT,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. App Config
CREATE TABLE IF NOT EXISTS public.app_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Audit Logs (Immutable)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role  TEXT NOT NULL DEFAULT 'system',
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── STEP 3: TRIGGERS ─────────────────────────────────────────────────────────

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

-- Automatic profile creation on auth.users insert
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

-- ─── STEP 4: ATOMIC RESERVATION FUNCTIONS ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_reservation_atomic(
  p_listing_id         UUID,
  p_recipient_org_id   UUID,
  p_reserved_by        UUID,
  p_quantity_requested NUMERIC,
  p_unit               TEXT,
  p_idempotency_key    TEXT,
  p_actor_role         TEXT DEFAULT 'user'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_listing          public.food_listings%ROWTYPE;
  v_available        NUMERIC;
  v_new_reserved     NUMERIC;
  v_new_status       TEXT;
  v_reservation_id   UUID;
  v_now              TIMESTAMPTZ := NOW();
  v_result           JSONB;
BEGIN
  -- Lock row with NOWAIT
  BEGIN
    SELECT * INTO v_listing
    FROM public.food_listings
    WHERE id = p_listing_id
    FOR UPDATE NOWAIT;
  EXCEPTION
    WHEN lock_not_available THEN
      RAISE EXCEPTION 'LOCK_CONFLICT: Concurrent reservation in progress, please retry'
        USING ERRCODE = 'P0001';
  END;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LISTING_NOT_FOUND: Listing % does not exist', p_listing_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_listing.status NOT IN ('published', 'partially_reserved') THEN
    RAISE EXCEPTION 'LISTING_NOT_RESERVABLE: Listing status is %', v_listing.status
      USING ERRCODE = 'P0003';
  END IF;

  IF v_listing.expires_at <= v_now THEN
    RAISE EXCEPTION 'LISTING_EXPIRED: Listing deadline has passed'
      USING ERRCODE = 'P0004';
  END IF;

  v_available := v_listing.quantity_offered - v_listing.quantity_reserved;

  IF p_quantity_requested <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY: Quantity must be positive'
      USING ERRCODE = 'P0007';
  END IF;

  IF p_quantity_requested > v_available THEN
    RAISE EXCEPTION 'INSUFFICIENT_QUANTITY: Only % % available, % requested',
      v_available, p_unit, p_quantity_requested
      USING ERRCODE = 'P0008';
  END IF;

  v_new_reserved := v_listing.quantity_reserved + p_quantity_requested;
  IF v_new_reserved >= v_listing.quantity_offered THEN
    v_new_status := 'fully_reserved';
  ELSE
    v_new_status := 'partially_reserved';
  END IF;

  v_reservation_id := gen_random_uuid();

  INSERT INTO public.reservations (
    id, listing_id, recipient_org_id, reserved_by, quantity_requested,
    unit, status, idempotency_key, confirmed_at, pickup_deadline, is_demo
  ) VALUES (
    v_reservation_id, p_listing_id, p_recipient_org_id, p_reserved_by, p_quantity_requested,
    p_unit, 'confirmed', p_idempotency_key, v_now, v_listing.pickup_window_end, v_listing.is_demo
  );

  UPDATE public.food_listings
  SET
    quantity_reserved = v_new_reserved,
    status = v_new_status,
    updated_at = v_now
  WHERE id = p_listing_id;

  BEGIN
    INSERT INTO public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, new_data)
    VALUES (
      p_reserved_by, p_actor_role, 'reservation_created', 'reservation', v_reservation_id,
      jsonb_build_object(
        'reservation_id', v_reservation_id,
        'listing_id', p_listing_id,
        'quantity_requested', p_quantity_requested,
        'unit', p_unit,
        'quantity_available_before', v_available,
        'new_listing_status', v_new_status
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  v_result := jsonb_build_object(
    'id', v_reservation_id,
    'listing_id', p_listing_id,
    'quantity_requested', p_quantity_requested,
    'unit', p_unit,
    'status', 'confirmed',
    'confirmed_at', v_now,
    'listing_status', v_new_status,
    'quantity_available_after', v_listing.quantity_offered - v_new_reserved
  );

  RETURN v_result;
END;
$$;

-- ─── STEP 5: IDEMPOTENT ROW LEVEL SECURITY (RLS) POLICIES ────────────────────

ALTER TABLE public.profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_listings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_assignments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handoffs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config                ENABLE ROW LEVEL SECURITY;

-- Clean existing policies safely
DO $$ DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 1. Profiles
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (id = auth.uid() OR auth.uid() IS NULL);
CREATE POLICY "profiles_insert_all" ON public.profiles FOR INSERT WITH CHECK (true);

-- 2. Organizations
CREATE POLICY "orgs_select_all" ON public.organizations FOR SELECT USING (true);
CREATE POLICY "orgs_insert_all" ON public.organizations FOR INSERT WITH CHECK (true);
CREATE POLICY "orgs_update_all" ON public.organizations FOR UPDATE USING (true);
CREATE POLICY "orgs_delete_all" ON public.organizations FOR DELETE USING (true);

-- 3. Organization Members
CREATE POLICY "org_members_select_all" ON public.organization_members FOR SELECT USING (true);
CREATE POLICY "org_members_insert_all" ON public.organization_members FOR INSERT WITH CHECK (true);
CREATE POLICY "org_members_update_all" ON public.organization_members FOR UPDATE USING (true);
CREATE POLICY "org_members_delete_all" ON public.organization_members FOR DELETE USING (true);

-- 4. Verification Applications
CREATE POLICY "verif_apps_select_all" ON public.verification_applications FOR SELECT USING (true);
CREATE POLICY "verif_apps_insert_all" ON public.verification_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "verif_apps_update_all" ON public.verification_applications FOR UPDATE USING (true);

-- 5. Food Listings
CREATE POLICY "listings_select_all" ON public.food_listings FOR SELECT USING (true);
CREATE POLICY "listings_insert_all" ON public.food_listings FOR INSERT WITH CHECK (true);
CREATE POLICY "listings_update_all" ON public.food_listings FOR UPDATE USING (true);
CREATE POLICY "listings_delete_all" ON public.food_listings FOR DELETE USING (true);

-- 6. Reservations
CREATE POLICY "reservations_select_all" ON public.reservations FOR SELECT USING (true);
CREATE POLICY "reservations_insert_all" ON public.reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "reservations_update_all" ON public.reservations FOR UPDATE USING (true);

-- 7. Pickup Assignments
CREATE POLICY "pickup_select_all" ON public.pickup_assignments FOR SELECT USING (true);
CREATE POLICY "pickup_insert_all" ON public.pickup_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "pickup_update_all" ON public.pickup_assignments FOR UPDATE USING (true);

-- 8. Handoffs
CREATE POLICY "handoffs_select_all" ON public.handoffs FOR SELECT USING (true);
CREATE POLICY "handoffs_insert_all" ON public.handoffs FOR INSERT WITH CHECK (true);
CREATE POLICY "handoffs_update_all" ON public.handoffs FOR UPDATE USING (true);

-- 9. Distribution Records
CREATE POLICY "distribution_select_all" ON public.distribution_records FOR SELECT USING (true);
CREATE POLICY "distribution_insert_all" ON public.distribution_records FOR INSERT WITH CHECK (true);
CREATE POLICY "distribution_update_all" ON public.distribution_records FOR UPDATE USING (true);

-- 10. Notifications
CREATE POLICY "notif_select_all" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "notif_insert_all" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notif_update_all" ON public.notifications FOR UPDATE USING (true);

-- 11. Device Tokens
CREATE POLICY "tokens_all" ON public.device_tokens FOR ALL USING (true);

-- 12. Safety Reports
CREATE POLICY "safety_select_all" ON public.safety_reports FOR SELECT USING (true);
CREATE POLICY "safety_insert_all" ON public.safety_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "safety_update_all" ON public.safety_reports FOR UPDATE USING (true);

-- 13. App Config
CREATE POLICY "config_select_all" ON public.app_config FOR SELECT USING (true);
CREATE POLICY "config_write_all"  ON public.app_config FOR ALL    USING (true);

-- 14. Audit Logs
CREATE POLICY "audit_select_all" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "audit_insert_all" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- ─── STEP 6: REALTIME WEBSOCKET REPLICATION ───────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE 
      public.food_listings,
      public.reservations,
      public.pickup_assignments,
      public.handoffs,
      public.distribution_records,
      public.safety_reports,
      public.organizations,
      public.app_config,
      public.audit_logs;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ─── STEP 7: SEED OPERATIONAL CONFIG & INITIAL DEMO DATA ──────────────────────

INSERT INTO public.app_config (key, value, description)
VALUES
  (
    'platform_settings',
    '{"max_reservation_window_hours": 12, "otp_ttl_minutes": 30, "max_otp_attempts": 5, "require_fssai_for_cooked_meals": true}'::JSONB,
    'Core operational parameters for food rescue lifecycle.'
  ),
  (
    'safety_advisory',
    '{"active": true, "banner_text": "High temperature alert in Delhi NCR: Please ensure insulated carriers for all cooked food transfers.", "severity": "info"}'::JSONB,
    'Global safety notification shown across mobile applications.'
  )
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- Insert standard organizations (demo tagged so live impact counters are pristine)
INSERT INTO public.organizations (
  id, name, org_type, description, address_line1, city, state, pincode, country,
  latitude, longitude, phone, email, fssai_number, verification_status, verified_at, is_demo
) VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Taj Palace Central Kitchen',
    'donor',
    'Five-star hospitality kitchen providing surplus banquet and buffet meals under strict food hygiene standards.',
    '2 Sardar Patel Marg, Diplomatic Enclave',
    'New Delhi', 'Delhi', '110021', 'IN',
    28.596128, 77.173167, '+911126110202', 'banquets.taj@example.com',
    '10014011000123', 'verified', NOW() - INTERVAL '30 days', true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Green Harvest Artisan Bakery',
    'donor',
    'Daily artisanal bread, rolls, sandwiches, and sourdough surplus packed at end of shifts.',
    '14 Khan Market Front Row',
    'New Delhi', 'Delhi', '110003', 'IN',
    28.600100, 77.227200, '+911143556677', 'hello@greenharvest.example.com',
    '13318005000456', 'verified', NOW() - INTERVAL '20 days', true
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Fresh Feast Institutional Caterers',
    'donor',
    'Campus and corporate dining facility with daily prepared surplus meals.',
    'Plot 42 Okhla Phase III',
    'New Delhi', 'Delhi', '110020', 'IN',
    28.541200, 77.273400, '+911145678900', 'contact@freshfeast.example.com',
    '10020011000789', 'pending', NULL, true
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'Robin Hood Food Rescue Delhi Chapter',
    'recipient',
    'Community volunteer network redistributing excess cooked food to shelters and nighttime clusters.',
    'Block C, Defence Colony',
    'New Delhi', 'Delhi', '110024', 'IN',
    28.572900, 77.230900, '+911124698888', 'delhi@robinhoodarmy.example.org',
    NULL, 'verified', NOW() - INTERVAL '45 days', true
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    'Annakshetra Charitable Relief Trust',
    'recipient',
    'Registered non-profit operating two community dining halls feeding 800+ vulnerable individuals daily.',
    '18 Pusa Road, Karol Bagh',
    'New Delhi', 'Delhi', '110005', 'IN',
    28.644800, 77.189400, '+911125741122', 'care@annakshetra.example.org',
    NULL, 'verified', NOW() - INTERVAL '60 days', true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  verification_status = EXCLUDED.verification_status;

-- ─── STEP 8: SEED SAMPLE LISTINGS & AUDIT TRAIL ──────────────────────────────

-- Ensure a demo donor creator profile exists in auth or fallback
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002') THEN
    INSERT INTO auth.users (id, email)
    VALUES ('00000000-0000-0000-0000-000000000002', 'donor.taj@shareplate.org')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profiles (id, full_name, app_role, phone)
    VALUES ('00000000-0000-0000-0000-000000000002', 'Chef Rajesh Kumar', 'user', '+919811223344')
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

INSERT INTO public.food_listings (
  id, donor_org_id, created_by, title, description, category, dietary_flags,
  quantity_offered, quantity_reserved, quantity_collected, quantity_accepted, quantity_distributed,
  unit, prepared_at, expires_at, allergens, storage_requirements, transport_requirements,
  pickup_address, pickup_latitude, pickup_longitude, pickup_window_start, pickup_window_end,
  status, published_at, is_demo
) VALUES
  (
    'f0000000-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000002',
    'Fresh Vegetable Biryani & Dal Makhani Feast',
    'Premium basmati biryani, rich slow-simmered dal makhani, and mint raita prepared for diplomatic luncheon. Chilled immediately in blast chillers.',
    'cooked_meal', ARRAY['vegetarian', 'halal'],
    65.000, 0.000, 0.000, 0.000, 0.000,
    'portions',
    NOW() - INTERVAL '2 hours',
    NOW() + INTERVAL '10 hours',
    'Dairy (milk cream in dal, yoghurt in raita). Nut traces possible.',
    'Refrigerated below 4°C. Food packed in food-grade thermal insulated containers.',
    'Insulated carrier boxes required. Keep upright.',
    '2 Sardar Patel Marg, Hotel Rear Goods Entry Bay 3, New Delhi',
    28.596128, 77.173167,
    NOW() + INTERVAL '30 minutes',
    NOW() + INTERVAL '4 hours',
    'published',
    NOW() - INTERVAL '1 hour',
    true
  ),
  (
    'f0000000-0000-0000-0000-000000000002',
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000002',
    'Artisan Sourdough Loaves & Multigrain Rolls',
    'Fresh baked loaves from today morning batch. Crisp crust, baked without preservatives.',
    'bakery', ARRAY['vegetarian', 'vegan'],
    30.000, 15.000, 0.000, 0.000, 0.000,
    'kg',
    NOW() - INTERVAL '4 hours',
    NOW() + INTERVAL '24 hours',
    'Wheat gluten, sesame seeds',
    'Dry ambient storage away from moisture.',
    'Clean crates or dry paper bags.',
    '14 Khan Market, Back Lane Entrance, New Delhi',
    28.600100, 77.227200,
    NOW() + INTERVAL '1 hour',
    NOW() + INTERVAL '6 hours',
    'partially_reserved',
    NOW() - INTERVAL '3 hours',
    true
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.audit_logs (actor_role, action, entity_type, new_data)
VALUES (
  'admin',
  'SUPABASE_PRODUCTION_INITIALIZED',
  'system',
  '{"version":"1.0.0","project":"jlylvqbljwbwfqmisnfo","status":"ready"}'::JSONB
);

-- ==============================================================================
-- DEPLOYMENT COMPLETE! All tables, policies, functions, publications are ready.
-- ==============================================================================
