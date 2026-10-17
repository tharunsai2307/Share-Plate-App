-- SharePlate Migration 004: Enable Realtime Publications
-- Enables Supabase Realtime WebSocket broadcasting on core operational tables
-- Date: 2026-10-16

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
END $$;
