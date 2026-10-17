# SharePlate — Deployment Guide

**Version:** 0.1.0
**Date:** 2026-10-16

---

## Prerequisites

- Node.js >= 20
- npm >= 10
- Git >= 2.40
- Supabase CLI (`npm install -g supabase`)
- Expo CLI + EAS CLI (`npm install -g expo-cli eas-cli`)
- Android Studio or Xcode (for native mobile builds)

---

## Environment Setup

### 1. Clone repository

```bash
git clone git@github.com:tharunsai2307/Share-Plate-App.git
cd Share-Plate-App
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env.local
# Edit .env.local with your actual Supabase credentials
```

Required variables:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Never in client bundles
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_DB_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

---

## Local Development

### Start Supabase locally

```bash
supabase start
# This starts local PostgreSQL, Auth, Storage, Edge Functions
```

### Apply migrations

```bash
supabase db push
# or for local dev:
supabase db reset  # WARNING: drops and recreates local DB
```

### Run admin web app

```bash
cd apps/admin
npm run dev
# Opens at http://localhost:3000
```

### Run mobile app

```bash
cd apps/mobile
npx expo start
# Scan QR code with Expo Go, or press 'a' for Android emulator, 'i' for iOS simulator
```

### Run tests

```bash
# From workspace root
npm test                    # All unit tests
npm run test:shared         # Shared package tests only
npm run test:admin          # Admin web tests
npm run test:e2e            # Playwright E2E tests (requires admin running)
```

---

## Supabase Project Setup (Production)

1. Create project at https://supabase.com/dashboard
2. Copy project URL and anon key to environment variables
3. Copy service role key to environment variables (keep secret)
4. Link CLI: `supabase link --project-ref your-project-ref`
5. Push migrations: `supabase db push`
6. Deploy Edge Functions: `supabase functions deploy`
7. Configure storage buckets (see supabase/storage-config.sql)

---

## Mobile Builds (EAS)

### Setup EAS

```bash
eas login
eas build:configure
# Creates eas.json with development/preview/production profiles
```

### Development build (for Expo Go replacement)

```bash
cd apps/mobile
eas build --profile development --platform android
# or
eas build --profile development --platform ios
```

### Preview build

```bash
eas build --profile preview --platform all
```

### Production build

```bash
eas build --profile production --platform all
# Then submit to stores:
eas submit --platform android
eas submit --platform ios
```

---

## OTA Updates (EAS Update)

### Channels
- `development`: local dev, automatic
- `preview`: internal testing, semi-automatic
- `production`: user-facing, requires explicit authorization

### Publish preview update

```bash
cd apps/mobile
eas update --channel preview --message "Fix: reservation quantity validation"
```

### Publish production update

**Only after testing on preview channel:**

```bash
eas update --channel production --message "Fix: ..." --auto
```

### Incompatible updates (native changes)

If you add or change native modules, Expo plugins, permissions, or SDK version:
- A new binary build is required
- OTA update will NOT apply to older binary
- Submit new build to app stores
- Communicate update requirement to users

### Rollback

```bash
eas update:rollback --channel production
# Reverts to previous published update
```

---

## CI/CD (GitHub Actions)

Workflows in `.github/workflows/`:

| Workflow | Trigger | Action |
|----------|---------|--------|
| `ci.yml` | Push to any branch | Lint, type check, unit tests |
| `e2e.yml` | PR to main | Playwright E2E tests |
| `deploy-admin.yml` | Push to main | Deploy admin to Vercel/hosting |
| `eas-preview.yml` | Push to main | Publish EAS preview update |
| `eas-production.yml` | Manual trigger + version tag | Publish EAS production update |

Production deploy requires `SUPABASE_SERVICE_ROLE_KEY` and `EXPO_TOKEN` secrets in GitHub repository settings.

---

## Health Checks

After deployment:

1. Admin app loads at production URL
2. Auth: sign in with admin@shareplate.test
3. Supabase: check project health at Supabase dashboard
4. Edge Functions: test create-reservation function responds
5. Realtime: confirm subscription connects
6. Storage: upload a test image, verify signed URL works
7. Mobile: install preview build, complete a reservation flow

---

## Database Backup

- Supabase automatically creates daily backups for Pro plan
- For local/staging: `supabase db dump > backup-$(date +%Y%m%d).sql`
- Restore: `psql $SUPABASE_DB_URL < backup-YYYYMMDD.sql`

---

## Rollback Plan

| Layer | Rollback Method |
|-------|----------------|
| Database migration | Apply reverse migration from supabase/migrations/rollback/ |
| Edge Functions | Redeploy previous version via `supabase functions deploy --version` |
| Admin web | Redeploy previous Vercel deployment |
| Mobile OTA | `eas update:rollback --channel production` |
| Mobile binary | Previous store version cannot be forced; issue hotfix build |

---

## Known Limitations Before Production Launch

1. Supabase project must be provisioned (placeholder config used in development)
2. EAS project ID must be configured (placeholder in eas.json)
3. Push notification credentials (FCM key for Android, APNs cert for iOS) must be configured in EAS
4. App Store and Google Play accounts required for store distribution
5. Production signing credentials must be generated via EAS (`eas credentials`)
6. Legal review required: privacy policy, terms of service, food safety disclaimer
7. FSSAI compliance review required before onboarding real food businesses
