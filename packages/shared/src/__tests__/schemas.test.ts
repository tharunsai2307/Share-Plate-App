/**
 * Unit tests for Zod validation schemas.
 */

import {
  CreateFoodListingSchema,
  CreateReservationSchema,
  VerifyHandoverCodeSchema,
  RecordDistributionSchema,
  isValidListingTransition,
  isValidReservationTransition,
} from '../schemas.js';

// ─── CreateFoodListingSchema ──────────────────────────────────────────────────

describe('CreateFoodListingSchema', () => {
  const now = new Date();
  const future = (hours: number) => new Date(now.getTime() + hours * 3600 * 1000).toISOString();
  const past = (hours: number) => new Date(now.getTime() - hours * 3600 * 1000).toISOString();

  const validListing = {
    donor_org_id: '00000000-0000-0000-0000-000000000001',
    title: 'Dal Makhani and Rice',
    category: 'cooked_meal',
    dietary_flags: ['vegetarian'],
    quantity_offered: 50,
    unit: 'portions',
    prepared_at: past(2),
    expires_at: future(10),
    pickup_address: '123 Main Street, Hyderabad',
    pickup_window_start: future(1),
    pickup_window_end: future(5),
  };

  it('accepts valid listing', () => {
    const result = CreateFoodListingSchema.safeParse(validListing);
    expect(result.success).toBe(true);
  });

  it('rejects negative quantity', () => {
    const result = CreateFoodListingSchema.safeParse({ ...validListing, quantity_offered: -5 });
    expect(result.success).toBe(false);
  });

  it('rejects zero quantity', () => {
    const result = CreateFoodListingSchema.safeParse({ ...validListing, quantity_offered: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects expires_at before prepared_at', () => {
    const result = CreateFoodListingSchema.safeParse({
      ...validListing,
      expires_at: past(3),
    });
    expect(result.success).toBe(false);
  });

  it('rejects pickup_window_end before pickup_window_start', () => {
    const result = CreateFoodListingSchema.safeParse({
      ...validListing,
      pickup_window_end: future(0.5),
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid food unit', () => {
    const result = CreateFoodListingSchema.safeParse({ ...validListing, unit: 'gallons' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid category', () => {
    const result = CreateFoodListingSchema.safeParse({ ...validListing, category: 'junk_food' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid donor_org_id (not UUID)', () => {
    const result = CreateFoodListingSchema.safeParse({ ...validListing, donor_org_id: 'not-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects quantity with more than 3 decimal places', () => {
    const result = CreateFoodListingSchema.safeParse({
      ...validListing,
      quantity_offered: 10.1234,
    });
    expect(result.success).toBe(false);
  });
});

// ─── CreateReservationSchema ──────────────────────────────────────────────────

describe('CreateReservationSchema', () => {
  const validReservation = {
    listing_id: '00000000-0000-0000-0000-000000000002',
    quantity_requested: 10,
    unit: 'portions',
    idempotency_key: 'idem-key-12345',
  };

  it('accepts valid reservation', () => {
    expect(CreateReservationSchema.safeParse(validReservation).success).toBe(true);
  });

  it('rejects zero quantity', () => {
    expect(
      CreateReservationSchema.safeParse({ ...validReservation, quantity_requested: 0 }).success
    ).toBe(false);
  });

  it('rejects missing idempotency key', () => {
    const { idempotency_key: _, ...rest } = validReservation;
    expect(CreateReservationSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects invalid listing_id', () => {
    expect(
      CreateReservationSchema.safeParse({ ...validReservation, listing_id: 'bad-id' }).success
    ).toBe(false);
  });
});

// ─── VerifyHandoverCodeSchema ─────────────────────────────────────────────────

describe('VerifyHandoverCodeSchema', () => {
  it('accepts valid 6-digit code', () => {
    expect(
      VerifyHandoverCodeSchema.safeParse({
        handoff_id: '00000000-0000-0000-0000-000000000003',
        code: '123456',
      }).success
    ).toBe(true);
  });

  it('rejects 5-digit code', () => {
    expect(
      VerifyHandoverCodeSchema.safeParse({
        handoff_id: '00000000-0000-0000-0000-000000000003',
        code: '12345',
      }).success
    ).toBe(false);
  });

  it('rejects code with letters', () => {
    expect(
      VerifyHandoverCodeSchema.safeParse({
        handoff_id: '00000000-0000-0000-0000-000000000003',
        code: '12345A',
      }).success
    ).toBe(false);
  });

  it('rejects 7-digit code', () => {
    expect(
      VerifyHandoverCodeSchema.safeParse({
        handoff_id: '00000000-0000-0000-0000-000000000003',
        code: '1234567',
      }).success
    ).toBe(false);
  });
});

// ─── RecordDistributionSchema ─────────────────────────────────────────────────

describe('RecordDistributionSchema', () => {
  const validDistribution = {
    reservation_id: '00000000-0000-0000-0000-000000000004',
    quantity_distributed: 18,
    unit: 'portions',
    distributed_at: '2026-10-16T15:00:00Z',
    beneficiary_count: 60,
  };

  it('accepts valid distribution', () => {
    expect(RecordDistributionSchema.safeParse(validDistribution).success).toBe(true);
  });

  it('rejects zero quantity_distributed', () => {
    expect(
      RecordDistributionSchema.safeParse({ ...validDistribution, quantity_distributed: 0 }).success
    ).toBe(false);
  });

  it('accepts distribution without beneficiary count', () => {
    const { beneficiary_count: _, ...rest } = validDistribution;
    expect(RecordDistributionSchema.safeParse(rest).success).toBe(true);
  });
});

// ─── State Transition Validators ──────────────────────────────────────────────

describe('isValidListingTransition', () => {
  it('allows draft → published', () => {
    expect(isValidListingTransition('draft', 'published')).toBe(true);
  });

  it('allows draft → cancelled', () => {
    expect(isValidListingTransition('draft', 'cancelled')).toBe(true);
  });

  it('disallows completed → published (terminal)', () => {
    expect(isValidListingTransition('completed', 'published')).toBe(false);
  });

  it('disallows expired → reserved', () => {
    expect(isValidListingTransition('expired', 'fully_reserved')).toBe(false);
  });

  it('disallows arbitrary unknown transition', () => {
    expect(isValidListingTransition('completed', 'draft')).toBe(false);
  });

  it('allows suspended → published (admin reinstatement)', () => {
    expect(isValidListingTransition('suspended', 'published')).toBe(true);
  });
});

describe('isValidReservationTransition', () => {
  it('allows confirmed → cancelled', () => {
    expect(isValidReservationTransition('confirmed', 'cancelled')).toBe(true);
  });

  it('allows confirmed → completed', () => {
    expect(isValidReservationTransition('confirmed', 'completed')).toBe(true);
  });

  it('disallows completed → confirmed (terminal)', () => {
    expect(isValidReservationTransition('completed', 'confirmed')).toBe(false);
  });

  it('disallows cancelled → confirmed', () => {
    expect(isValidReservationTransition('cancelled', 'confirmed')).toBe(false);
  });
});
