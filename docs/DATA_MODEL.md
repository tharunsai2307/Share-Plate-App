# SharePlate — Data Model

**Version:** 0.1.0
**Date:** 2026-10-16

---

## Conventions

- All primary keys: UUID (gen_random_uuid())
- All timestamps: TIMESTAMPTZ stored in UTC
- Soft deletes: deleted_at TIMESTAMPTZ nullable
- Audit: every table has created_at, updated_at
- Quantities: NUMERIC(12,3) — never FLOAT
- Status fields: constrained via CHECK or FK to enum table

---

## Tables

### profiles
Extends Supabase auth.users with application-level data.

```sql
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  avatar_url      TEXT,
  app_role        TEXT NOT NULL DEFAULT 'user'
                  CHECK (app_role IN ('user', 'volunteer', 'admin')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  suspended_at    TIMESTAMPTZ,
  suspension_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### organizations
Donors and recipient organizations.

```sql
CREATE TABLE organizations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  org_type            TEXT NOT NULL CHECK (org_type IN ('donor', 'recipient', 'both')),
  description         TEXT,
  address_line1       TEXT,
  address_line2       TEXT,
  city                TEXT NOT NULL,
  state               TEXT NOT NULL,
  pincode             TEXT,
  country             TEXT NOT NULL DEFAULT 'IN',
  latitude            NUMERIC(9,6),
  longitude           NUMERIC(9,6),
  phone               TEXT,
  email               TEXT,
  website             TEXT,
  fssai_number        TEXT,
  registration_number TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
                      CHECK (verification_status IN ('unverified','pending','verified','rejected','suspended')),
  verified_at         TIMESTAMPTZ,
  verified_by         UUID REFERENCES profiles(id),
  suspended_at        TIMESTAMPTZ,
  suspension_reason   TEXT,
  is_demo             BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### organization_members
Many-to-many: profiles <-> organizations with role.

```sql
CREATE TABLE organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_role     TEXT NOT NULL DEFAULT 'member'
                  CHECK (member_role IN ('owner', 'manager', 'member')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);
```

### verification_applications
Submitted when an org requests verification.

```sql
CREATE TABLE verification_applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  submitted_by    UUID NOT NULL REFERENCES profiles(id),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','under_review','approved','rejected')),
  documents       JSONB NOT NULL DEFAULT '[]',  -- [{name, storage_path, type}]
  notes           TEXT,
  reviewer_id     UUID REFERENCES profiles(id),
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### food_listings

```sql
CREATE TABLE food_listings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_org_id          UUID NOT NULL REFERENCES organizations(id),
  created_by            UUID NOT NULL REFERENCES profiles(id),
  title                 TEXT NOT NULL,
  description           TEXT,
  category              TEXT NOT NULL
                        CHECK (category IN ('cooked_meal','bakery','produce','dairy','packaged','beverage','other')),
  dietary_flags         TEXT[] NOT NULL DEFAULT '{}',
  -- e.g. ['vegetarian','vegan','gluten_free','halal','jain']
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
  pickup_address        TEXT NOT NULL,
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
  photos                TEXT[] NOT NULL DEFAULT '{}',  -- storage paths
  contact_name          TEXT,
  contact_phone         TEXT,
  is_demo               BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Quantity invariants
  CONSTRAINT qty_reserved_le_offered   CHECK (quantity_reserved   <= quantity_offered),
  CONSTRAINT qty_collected_le_reserved CHECK (quantity_collected  <= quantity_reserved + 0.001),
  CONSTRAINT qty_accepted_le_collected CHECK (quantity_accepted   <= quantity_collected + 0.001),
  CONSTRAINT qty_distributed_le_accepted CHECK (quantity_distributed <= quantity_accepted + 0.001)
);
```

### reservations

```sql
CREATE TABLE reservations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        UUID NOT NULL REFERENCES food_listings(id),
  recipient_org_id  UUID NOT NULL REFERENCES organizations(id),
  reserved_by       UUID NOT NULL REFERENCES profiles(id),
  quantity_requested NUMERIC(12,3) NOT NULL CHECK (quantity_requested > 0),
  unit              TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'confirmed'
                    CHECK (status IN ('pending','confirmed','cancelled','expired','completed','disputed')),
  idempotency_key   TEXT UNIQUE,
  confirmed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pickup_deadline   TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancelled_by      UUID REFERENCES profiles(id),
  completed_at      TIMESTAMPTZ,
  is_demo           BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### pickup_assignments

```sql
CREATE TABLE pickup_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  UUID NOT NULL REFERENCES reservations(id),
  listing_id      UUID NOT NULL REFERENCES food_listings(id),
  volunteer_id    UUID REFERENCES profiles(id),
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
```

### handoffs
Records the actual physical transfer.

```sql
CREATE TABLE handoffs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id       UUID NOT NULL REFERENCES pickup_assignments(id),
  reservation_id      UUID NOT NULL REFERENCES reservations(id),
  verification_code_hash TEXT,         -- bcrypt hash of 6-digit OTP
  code_expires_at     TIMESTAMPTZ,
  code_attempts       INTEGER NOT NULL DEFAULT 0,
  code_verified_at    TIMESTAMPTZ,
  quantity_confirmed  NUMERIC(12,3),
  quantity_rejected   NUMERIC(12,3) NOT NULL DEFAULT 0,
  rejection_reason    TEXT,
  donor_confirmed_by  UUID REFERENCES profiles(id),
  recipient_confirmed_by UUID REFERENCES profiles(id),
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','code_sent','verified','completed','partial','failed','disputed')),
  donor_notes         TEXT,
  recipient_notes     TEXT,
  is_demo             BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### distribution_records

```sql
CREATE TABLE distribution_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id    UUID NOT NULL REFERENCES reservations(id),
  recipient_org_id  UUID NOT NULL REFERENCES organizations(id),
  recorded_by       UUID NOT NULL REFERENCES profiles(id),
  quantity_distributed NUMERIC(12,3) NOT NULL CHECK (quantity_distributed > 0),
  unit              TEXT NOT NULL,
  distributed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  beneficiary_count INTEGER,
  distribution_notes TEXT,
  is_demo           BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### notifications

```sql
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id    UUID NOT NULL REFERENCES profiles(id),
  type            TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  data            JSONB,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### device_tokens

```sql
CREATE TABLE device_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL CHECK (platform IN ('ios','android','web')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);
```

### audit_logs
Append-only. No UPDATE or DELETE permitted via RLS.

```sql
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES profiles(id),
  actor_role  TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### safety_reports

```sql
CREATE TABLE safety_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID REFERENCES food_listings(id),
  reservation_id  UUID REFERENCES reservations(id),
  reported_by     UUID NOT NULL REFERENCES profiles(id),
  report_type     TEXT NOT NULL
                  CHECK (report_type IN ('food_safety','quality','quantity_dispute','no_show','fraud','other')),
  description     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','under_review','resolved','escalated')),
  resolved_by     UUID REFERENCES profiles(id),
  resolved_at     TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### app_config
Remote configuration — admin-managed, validated against schema.

```sql
CREATE TABLE app_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  value       JSONB NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Key Indexes

```sql
-- Active listings discovery
CREATE INDEX idx_food_listings_status_window ON food_listings(status, pickup_window_end)
  WHERE status IN ('published','partially_reserved');

-- Geospatial (when PostGIS available)
-- CREATE INDEX idx_food_listings_location ON food_listings USING GIST(...);

-- Reservations by org
CREATE INDEX idx_reservations_recipient_org ON reservations(recipient_org_id, status);

-- Reservations by listing
CREATE INDEX idx_reservations_listing ON reservations(listing_id, status);

-- Pickup assignments by volunteer
CREATE INDEX idx_pickup_assignments_volunteer ON pickup_assignments(volunteer_id, status);

-- Audit log by entity
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);

-- Audit log by actor
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);

-- Notifications by recipient
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC);

-- Org verification queue
CREATE INDEX idx_orgs_verification ON organizations(verification_status, created_at)
  WHERE verification_status IN ('pending','under_review');
```
