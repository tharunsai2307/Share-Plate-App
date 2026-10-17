-- SharePlate Seed Data
-- Provides realistic test users, organizations, listings, reservations, and audit trail.
-- All seed entities are marked with is_demo = true so they are excluded from live impact totals.
-- Date: 2026-10-16

-- ─── Clean Existing Demo Data ───────────────────────────────────────────────────

DELETE FROM public.audit_logs WHERE actor_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000007'
);
DELETE FROM public.organizations WHERE is_demo = true;
DELETE FROM auth.users WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000007'
);

-- ─── 1. Auth Users ─────────────────────────────────────────────────────────────
-- Password for all demo accounts: TestPass123!
-- Encrypted with standard blowfish/bcrypt cost factor

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'admin@shareplate.org',
    crypt('TestPass123!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Priya Sharma"}', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'donor.taj@shareplate.org',
    crypt('TestPass123!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Chef Rajesh Kumar"}', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'donor.bakery@shareplate.org',
    crypt('TestPass123!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Anita Mehta"}', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'ngo.robin@shareplate.org',
    crypt('TestPass123!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Vikram Roy"}', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'ngo.annakshetra@shareplate.org',
    crypt('TestPass123!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Sunita Deshmukh"}', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'volunteer.arun@shareplate.org',
    crypt('TestPass123!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Arun Patel"}', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'volunteer.maya@shareplate.org',
    crypt('TestPass123!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Maya Nair"}', NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Profiles (Augmented with Roles & Phone) ─────────────────────────────────

UPDATE public.profiles
SET app_role = 'admin', phone = '+919876543210'
WHERE id = '00000000-0000-0000-0000-000000000001';

UPDATE public.profiles
SET app_role = 'user', phone = '+919811223344'
WHERE id = '00000000-0000-0000-0000-000000000002';

UPDATE public.profiles
SET app_role = 'user', phone = '+919822334455'
WHERE id = '00000000-0000-0000-0000-000000000003';

UPDATE public.profiles
SET app_role = 'user', phone = '+919833445566'
WHERE id = '00000000-0000-0000-0000-000000000004';

UPDATE public.profiles
SET app_role = 'user', phone = '+919844556677'
WHERE id = '00000000-0000-0000-0000-000000000005';

UPDATE public.profiles
SET app_role = 'volunteer', phone = '+919855667788'
WHERE id = '00000000-0000-0000-0000-000000000006';

UPDATE public.profiles
SET app_role = 'volunteer', phone = '+919866778899'
WHERE id = '00000000-0000-0000-0000-000000000007';

-- ─── 3. Organizations ──────────────────────────────────────────────────────────

INSERT INTO public.organizations (
  id, name, org_type, description, address_line1, city, state, pincode, country,
  latitude, longitude, phone, email, fssai_number, verification_status, verified_at,
  verified_by, is_demo
) VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Taj Palace Central Kitchen',
    'donor',
    'Five-star hospitality kitchen providing surplus banquet and buffet meals under strict food hygiene standards.',
    '2 Sardar Patel Marg, Diplomatic Enclave',
    'New Delhi', 'Delhi', '110021', 'IN',
    28.596128, 77.173167, '+911126110202', 'banquets.taj@example.com',
    '10014011000123', 'verified', NOW() - INTERVAL '30 days',
    '00000000-0000-0000-0000-000000000001', true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Green Harvest Artisan Bakery',
    'donor',
    'Daily artisanal bread, rolls, sandwiches, and sourdough surplus packed at end of shifts.',
    '14 Khan Market Front Row',
    'New Delhi', 'Delhi', '110003', 'IN',
    28.600100, 77.227200, '+911143556677', 'hello@greenharvest.example.com',
    '13318005000456', 'verified', NOW() - INTERVAL '20 days',
    '00000000-0000-0000-0000-000000000001', true
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Fresh Feast Institutional Caterers',
    'donor',
    'Campus and corporate dining facility with daily prepared surplus meals.',
    'Plot 42 Okhla Phase III',
    'New Delhi', 'Delhi', '110020', 'IN',
    28.541200, 77.273400, '+911145678900', 'contact@freshfeast.example.com',
    '10020011000789', 'pending', NULL,
    NULL, true
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'Robin Hood Food Rescue Delhi Chapter',
    'recipient',
    'Community volunteer network redistributing excess cooked food to shelters and nighttime clusters.',
    'Block C, Defence Colony',
    'New Delhi', 'Delhi', '110024', 'IN',
    28.572900, 77.230900, '+911124698888', 'delhi@robinhoodarmy.example.org',
    NULL, 'verified', NOW() - INTERVAL '45 days',
    '00000000-0000-0000-0000-000000000001', true
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    'Annakshetra Charitable Relief Trust',
    'recipient',
    'Registered non-profit operating two community dining halls feeding 800+ vulnerable individuals daily.',
    '18 Pusa Road, Karol Bagh',
    'New Delhi', 'Delhi', '110005', 'IN',
    28.644800, 77.189400, '+911125741122', 'care@annakshetra.example.org',
    NULL, 'verified', NOW() - INTERVAL '60 days',
    '00000000-0000-0000-0000-000000000001', true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  verification_status = EXCLUDED.verification_status;

-- ─── 4. Organization Members ───────────────────────────────────────────────────

INSERT INTO public.organization_members (organization_id, user_id, member_role, is_active, accepted_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 'owner', true, NOW()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000003', 'owner', true, NOW()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000004', 'owner', true, NOW()),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000005', 'owner', true, NOW())
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- ─── 5. Verification Applications ──────────────────────────────────────────────

INSERT INTO public.verification_applications (
  id, organization_id, submitted_by, status, documents, notes, reviewer_id, reviewed_at, review_notes
) VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000003',
    'pending',
    '[{"title": "FSSAI License Certificate", "url": "https://storage.shareplate.org/docs/fssai_333.pdf", "type": "license"}, {"title": "Kitchen Hygiene Inspection Report", "url": "https://storage.shareplate.org/docs/hygiene_333.pdf", "type": "inspection"}]'::JSONB,
    'Institutional kitchen preparing 1200 meals daily with regular chilled surplus.',
    NULL, NULL, NULL
  )
ON CONFLICT (id) DO NOTHING;

-- ─── 6. Food Listings ──────────────────────────────────────────────────────────

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
    '00000000-0000-0000-0000-000000000003',
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
  ),
  (
    'f0000000-0000-0000-0000-000000000003',
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000002',
    'Steamed Rice, Paneer Butter Masala & Rotis',
    'Dinner banquet surplus. Wholesome vegetarian meal packed in 5-portion meal trays.',
    'cooked_meal', ARRAY['vegetarian'],
    40.000, 40.000, 0.000, 0.000, 0.000,
    'portions',
    NOW() - INTERVAL '3 hours',
    NOW() + INTERVAL '8 hours',
    'Dairy (paneer, butter), Gluten (rotis)',
    'Hot-box thermal containers maintained at 60°C.',
    'Vehicle with thermal insulation containers.',
    '2 Sardar Patel Marg, Hotel Rear Goods Entry Bay 3, New Delhi',
    28.596128, 77.173167,
    NOW() + INTERVAL '1 hour',
    NOW() + INTERVAL '3 hours',
    'fully_reserved',
    NOW() - INTERVAL '2 hours',
    true
  ),
  (
    'f0000000-0000-0000-0000-000000000004',
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000002',
    'Mixed Executive Lunch Trays',
    'Yesterday executive buffet surplus collected and safely distributed.',
    'cooked_meal', ARRAY['vegetarian', 'non_veg'],
    80.000, 80.000, 80.000, 80.000, 80.000,
    'portions',
    NOW() - INTERVAL '36 hours',
    NOW() - INTERVAL '12 hours',
    'Dairy, Gluten',
    'Refrigerated',
    'Thermal crates',
    '2 Sardar Patel Marg, Bay 3, New Delhi',
    28.596128, 77.173167,
    NOW() - INTERVAL '32 hours',
    NOW() - INTERVAL '28 hours',
    'completed',
    NOW() - INTERVAL '34 hours',
    true
  )
ON CONFLICT (id) DO NOTHING;

-- ─── 7. Reservations ──────────────────────────────────────────────────────────

INSERT INTO public.reservations (
  id, listing_id, recipient_org_id, reserved_by, quantity_requested, unit,
  status, idempotency_key, confirmed_at, is_demo
) VALUES
  (
    'r0000000-0000-0000-0000-000000000002',
    'f0000000-0000-0000-0000-000000000002',
    '44444444-4444-4444-4444-444444444444',
    '00000000-0000-0000-0000-000000000004',
    15.000, 'kg',
    'confirmed', 'demo-res-002',
    NOW() - INTERVAL '2 hours', true
  ),
  (
    'r0000000-0000-0000-0000-000000000003',
    'f0000000-0000-0000-0000-000000000003',
    '55555555-5555-5555-5555-555555555555',
    '00000000-0000-0000-0000-000000000005',
    40.000, 'portions',
    'confirmed', 'demo-res-003',
    NOW() - INTERVAL '1 hour', true
  ),
  (
    'r0000000-0000-0000-0000-000000000004',
    'f0000000-0000-0000-0000-000000000004',
    '44444444-4444-4444-4444-444444444444',
    '00000000-0000-0000-0000-000000000004',
    80.000, 'portions',
    'completed', 'demo-res-004',
    NOW() - INTERVAL '30 hours', true
  )
ON CONFLICT (id) DO NOTHING;

-- ─── 8. Pickup Assignments ────────────────────────────────────────────────────

INSERT INTO public.pickup_assignments (
  id, reservation_id, listing_id, volunteer_id, status, scheduled_at, started_at, is_demo
) VALUES
  (
    'a0000000-0000-0000-0000-000000000002',
    'r0000000-0000-0000-0000-000000000002',
    'f0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000006',
    'in_progress', NOW() + INTERVAL '1 hour', NOW() - INTERVAL '15 minutes', true
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'r0000000-0000-0000-0000-000000000003',
    'f0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000007',
    'scheduled', NOW() + INTERVAL '1 hour 30 minutes', NULL, true
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    'r0000000-0000-0000-0000-000000000004',
    'f0000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000006',
    'completed', NOW() - INTERVAL '30 hours', NOW() - INTERVAL '30 hours', true
  )
ON CONFLICT (id) DO NOTHING;

-- ─── 9. Handoffs ──────────────────────────────────────────────────────────────

INSERT INTO public.handoffs (
  id, assignment_id, reservation_id, verification_code_hash, code_expires_at,
  quantity_confirmed, status, is_demo
) VALUES
  (
    'h0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    'r0000000-0000-0000-0000-000000000002',
    crypt('482910', gen_salt('bf')),
    NOW() + INTERVAL '25 minutes',
    NULL,
    'code_sent',
    true
  ),
  (
    'h0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000004',
    'r0000000-0000-0000-0000-000000000004',
    NULL,
    NOW() - INTERVAL '29 hours',
    80.000,
    'completed',
    true
  )
ON CONFLICT (id) DO NOTHING;

-- ─── 10. Distribution Records ──────────────────────────────────────────────────

INSERT INTO public.distribution_records (
  id, reservation_id, recipient_org_id, recorded_by, quantity_distributed,
  unit, distributed_at, beneficiary_count, distribution_notes, is_demo
) VALUES
  (
    'd0000000-0000-0000-0000-000000000004',
    'r0000000-0000-0000-0000-000000000004',
    '44444444-4444-4444-4444-444444444444',
    '00000000-0000-0000-0000-000000000004',
    80.000,
    'portions',
    NOW() - INTERVAL '27 hours',
    95,
    'Distributed at Nizamuddin night shelter community kitchen. Zero incidents, fresh condition.',
    true
  )
ON CONFLICT (id) DO NOTHING;

-- ─── 11. Safety Reports ────────────────────────────────────────────────────────

INSERT INTO public.safety_reports (
  id, listing_id, reservation_id, reported_by, report_type, description, status
) VALUES
  (
    's0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000002',
    'r0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000004',
    'quality',
    'Minor packaging tear observed on two sourdough bags during collection staging. Remaining items intact and safe.',
    'resolved'
  )
ON CONFLICT (id) DO NOTHING;

-- ─── 12. App Config ────────────────────────────────────────────────────────────

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

-- ─── 13. Audit Log Entry for Seed Ingestion ───────────────────────────────────

INSERT INTO public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, new_data)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin',
  'SEED_DATA_INITIALIZED',
  'system',
  '00000000-0000-0000-0000-000000000000',
  '{"version":"0.1.0","environment":"local_demo","records_seeded":7}'::JSONB
);
