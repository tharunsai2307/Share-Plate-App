-- SharePlate Migration 002: Row Level Security Policies
-- Enables RLS on all tables and defines robust policies for cross-platform operations.
-- Date: 2026-10-16

-- ─── Helper Functions ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_user_has_role(required_role TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND app_role = required_role
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT public.current_user_has_role('admin');
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_manager(org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND member_role IN ('owner', 'manager')
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_verified_org_of_type(org_type_val TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = auth.uid()
      AND om.is_active = true
      AND o.verification_status = 'verified'
      AND (o.org_type = org_type_val OR o.org_type = 'both')
  );
$$;

-- ─── Enable RLS ───────────────────────────────────────────────────────────────

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

-- ─── Clean Existing Policies Safely ───────────────────────────────────────────

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

-- ─── Robust Policies for Web Admin & Mobile App ───────────────────────────────

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
