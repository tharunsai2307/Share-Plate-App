# SharePlate — Progress & Production Deployment Guide

**Updated:** 2026-10-16  
**Supabase Project ID:** `jlylvqbljwbwfqmisnfo`  
**Supabase Project URL:** `https://jlylvqbljwbwfqmisnfo.supabase.co`

---

## 1. System Baseline

- **Repository:** SharePlate Workspace (`c:\Users\Hp\Music\Mobile app`)
- **Target Repository:** https://github.com/tharunsai2307/Share-Plate-App
- **Node:** v24.15.0 | **npm:** 11.12.1
- **Live Supabase Credentials Configured:**
  - `NEXT_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL`: `https://jlylvqbljwbwfqmisnfo.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`: `[CONFIGURED_IN_ENV_LOCAL]`
  - `SUPABASE_SERVICE_ROLE_KEY`: `[CONFIGURED_IN_ENV_LOCAL]`
- **Total Automated Tests Passing:** 81 tests (71 shared domain/concurrency, 6 admin, 4 mobile)
- **TypeScript Typecheck:** 0 errors across all 3 workspaces (`@shareplate/shared`, `@shareplate/admin`, `@shareplate/mobile`)
- **Next.js 15 Production Build:** Successfully built with all 9 static pages pre-rendered

---

## 2. One-Click Launchers & Native Executables

1. **Admin Console Launcher:**
   - [`start-admin.bat`](file:///c:/Users/Hp/Music/Mobile%20app/start-admin.bat)
   - Double-click to start Next.js Admin server on port 3000 and automatically open your default browser.

2. **Mobile App Launcher:**
   - [`start-mobile.bat`](file:///c:/Users/Hp/Music/Mobile%20app/start-mobile.bat)
   - Double-click to start Expo Metro bundler on port 8081 and open in browser.

3. **Standalone Mobile Native Application (.exe):**
   - [`SharePlate-Mobile.exe`](file:///c:/Users/Hp/Music/Mobile%20app/SharePlate-Mobile.exe)
   - Compiled C# Windows desktop application that runs the mobile app in an isolated 430 × 880 smartphone phone-frame window.

---

## 3. Database Deployment to Supabase

The consolidated, master deployment SQL script is ready:
- [`supabase/deploy_all.sql`](file:///c:/Users/Hp/Music/Mobile%20app/supabase/deploy_all.sql)

### How to Apply to Your Supabase Cloud Project:
1. Open your Supabase Dashboard:
   👉 **https://supabase.com/dashboard/project/jlylvqbljwbwfqmisnfo/sql/new**
2. Copy the entire contents of [`supabase/deploy_all.sql`](file:///c:/Users/Hp/Music/Mobile%20app/supabase/deploy_all.sql) and paste into the SQL Editor.
3. Click **"Run"** (or press Ctrl+Enter).
4. All tables, triggers, idempotent RLS policies, atomic reservation stored procedures, realtime WebSocket channels, and initial verified organizations will be created in under 5 seconds!

---

## 4. Continuous Realtime Synchronization

- **Realtime Publications:** Enabled for `food_listings`, `reservations`, `pickup_assignments`, `handoffs`, `distribution_records`, `safety_reports`, `organizations`, `app_config`, and `audit_logs`.
- **Admin App:** Subscribes to postgres changes across all operational tables. When a donation is posted or reserved on mobile, the admin dashboard updates instantaneously without reloading.
- **Mobile App:** Subscribes to postgres changes. When an admin updates safety advisory or verifies a donor organization, all connected mobile devices reflect it in real time.

---

## 5. Production CI/CD Pipeline

- Configured in [`.github/workflows/ci.yml`](file:///c:/Users/Hp/Music/Mobile%20app/.github/workflows/ci.yml)
- 4-Stage Automated Pipeline:
  1. **Quality & Test Suite:** ESLint, Prettier check, Jest 81 tests, strict TypeScript typecheck.
  2. **Security & RLS Verification:** Scans for leaked keys, validates RLS on all public tables.
  3. **Admin Web Production Build:** Builds Next.js 15 bundle and validates build traces.
  4. **Mobile OTA Deploy:** Deploys updates over the air via EAS Update channel.
