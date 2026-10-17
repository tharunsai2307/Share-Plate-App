/**
 * Unit tests for business rules in packages/shared/src/rules.ts
 * These cover quantity invariants, availability, deadline eligibility,
 * state machine helpers, and impact metric calculations.
 */

import {
  computeAvailableQuantity,
  validateReservationQuantity,
  computeListingStatusAfterReservation,
  isPickupWindowOpen,
  isListingExpired,
  checkListingEligibility,
  safeRatio,
  formatRescueRate,
} from '../rules.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const now = new Date('2026-10-16T10:00:00Z');
const futureTime = new Date('2026-10-16T12:00:00Z'); // in future relative to now
const pastTime = new Date('2026-10-16T08:00:00Z'); // in past relative to now

// ─── computeAvailableQuantity ─────────────────────────────────────────────────

describe('computeAvailableQuantity', () => {
  it('returns offered minus reserved', () => {
    expect(computeAvailableQuantity({ quantity_offered: 10, quantity_reserved: 3 })).toBe(7);
  });

  it('returns 0 when fully reserved', () => {
    expect(computeAvailableQuantity({ quantity_offered: 10, quantity_reserved: 10 })).toBe(0);
  });

  it('never returns negative', () => {
    // Edge case: reserved slightly exceeds offered due to float drift — should clamp to 0
    expect(computeAvailableQuantity({ quantity_offered: 10, quantity_reserved: 10.001 })).toBe(0);
  });

  it('handles zero offered', () => {
    expect(computeAvailableQuantity({ quantity_offered: 0, quantity_reserved: 0 })).toBe(0);
  });

  it('handles decimal quantities correctly', () => {
    expect(computeAvailableQuantity({ quantity_offered: 5.5, quantity_reserved: 2.25 })).toBe(3.25);
  });
});

// ─── validateReservationQuantity ─────────────────────────────────────────────

describe('validateReservationQuantity', () => {
  const listing = {
    quantity_offered: 10,
    quantity_reserved: 3,
    unit: 'portions' as const,
    status: 'published' as const,
  };

  it('returns null for valid reservation', () => {
    expect(validateReservationQuantity(listing, 5, 'portions')).toBeNull();
  });

  it('returns error when quantity exceeds available', () => {
    const result = validateReservationQuantity(listing, 8, 'portions');
    expect(result).toMatch(/Only 7 portions available/);
  });

  it('returns error on unit mismatch', () => {
    const result = validateReservationQuantity(listing, 5, 'kg');
    expect(result).toMatch(/Unit mismatch/);
  });

  it('returns error for non-reservable status', () => {
    const expired = { ...listing, status: 'expired' as const };
    const result = validateReservationQuantity(expired, 5, 'portions');
    expect(result).toMatch(/not available for reservation/);
  });

  it('returns error for non-positive quantity', () => {
    const result = validateReservationQuantity(listing, 0, 'portions');
    expect(result).toMatch(/must be positive/);
  });

  it('returns error for negative quantity', () => {
    const result = validateReservationQuantity(listing, -1, 'portions');
    expect(result).toMatch(/must be positive/);
  });

  it('allows reserving exactly available quantity', () => {
    expect(validateReservationQuantity(listing, 7, 'portions')).toBeNull();
  });

  it('rejects fully_reserved listing', () => {
    const full = { ...listing, status: 'fully_reserved' as const };
    expect(validateReservationQuantity(full, 1, 'portions')).not.toBeNull();
  });

  it('accepts partially_reserved listing', () => {
    const partial = { ...listing, status: 'partially_reserved' as const };
    expect(validateReservationQuantity(partial, 5, 'portions')).toBeNull();
  });
});

// ─── computeListingStatusAfterReservation ─────────────────────────────────────

describe('computeListingStatusAfterReservation', () => {
  it('returns fully_reserved when all portions reserved', () => {
    expect(computeListingStatusAfterReservation(10, 10, 'published')).toBe('fully_reserved');
  });

  it('returns partially_reserved when some portions remain', () => {
    expect(computeListingStatusAfterReservation(10, 6, 'published')).toBe('partially_reserved');
  });

  it('returns published when all reservations cancelled (no reserved)', () => {
    expect(computeListingStatusAfterReservation(10, 0, 'partially_reserved')).toBe('published');
  });

  it('returns published when fully_reserved listing has all cancelled', () => {
    expect(computeListingStatusAfterReservation(10, 0, 'fully_reserved')).toBe('published');
  });

  it('preserves current status when 0 reserved from non-reservation status', () => {
    expect(computeListingStatusAfterReservation(10, 0, 'draft')).toBe('draft');
  });
});

// ─── isPickupWindowOpen ───────────────────────────────────────────────────────

describe('isPickupWindowOpen', () => {
  it('returns true when window end is in the future', () => {
    expect(isPickupWindowOpen(futureTime.toISOString(), now)).toBe(true);
  });

  it('returns false when window end is in the past', () => {
    expect(isPickupWindowOpen(pastTime.toISOString(), now)).toBe(false);
  });

  it('returns false when window end equals server time', () => {
    expect(isPickupWindowOpen(now.toISOString(), now)).toBe(false);
  });
});

// ─── isListingExpired ─────────────────────────────────────────────────────────

describe('isListingExpired', () => {
  it('returns true when expiry is in the past', () => {
    expect(isListingExpired(pastTime.toISOString(), now)).toBe(true);
  });

  it('returns false when expiry is in the future', () => {
    expect(isListingExpired(futureTime.toISOString(), now)).toBe(false);
  });

  it('returns true when expiry equals server time (at exactly deadline)', () => {
    expect(isListingExpired(now.toISOString(), now)).toBe(true);
  });
});

// ─── checkListingEligibility ─────────────────────────────────────────────────

describe('checkListingEligibility', () => {
  const eligibleListing = {
    status: 'published' as const,
    expires_at: futureTime.toISOString(),
    pickup_window_end: futureTime.toISOString(),
  };

  it('returns null for eligible listing', () => {
    expect(checkListingEligibility(eligibleListing, now)).toBeNull();
  });

  it('returns error for non-reservable status', () => {
    const result = checkListingEligibility(
      { ...eligibleListing, status: 'completed' as const },
      now
    );
    expect(result).toMatch(/not reservable/);
  });

  it('returns error for expired listing', () => {
    const result = checkListingEligibility(
      { ...eligibleListing, expires_at: pastTime.toISOString() },
      now
    );
    expect(result).toMatch(/expired/);
  });

  it('returns error when pickup window is closed', () => {
    const result = checkListingEligibility(
      { ...eligibleListing, pickup_window_end: pastTime.toISOString() },
      now
    );
    expect(result).toMatch(/Pickup window has closed/);
  });

  it('partially_reserved listing is eligible', () => {
    const result = checkListingEligibility(
      { ...eligibleListing, status: 'partially_reserved' as const },
      now
    );
    expect(result).toBeNull();
  });
});

// ─── safeRatio ───────────────────────────────────────────────────────────────

describe('safeRatio', () => {
  it('computes ratio correctly', () => {
    expect(safeRatio(18, 25)).toBeCloseTo(0.72, 4);
  });

  it('returns null when denominator is zero', () => {
    expect(safeRatio(0, 0)).toBeNull();
    expect(safeRatio(5, 0)).toBeNull();
  });

  it('returns 0 when numerator is zero and denominator is positive', () => {
    expect(safeRatio(0, 10)).toBe(0);
  });

  it('returns 1.0 for 100% rescue rate', () => {
    expect(safeRatio(10, 10)).toBe(1.0);
  });
});

// ─── formatRescueRate ─────────────────────────────────────────────────────────

describe('formatRescueRate', () => {
  it('formats 0.72 as 72%', () => {
    expect(formatRescueRate(0.72)).toBe('72%');
  });

  it('formats 1.0 as 100%', () => {
    expect(formatRescueRate(1.0)).toBe('100%');
  });

  it('formats null as N/A', () => {
    expect(formatRescueRate(null)).toBe('N/A');
  });

  it('formats 0 as 0%', () => {
    expect(formatRescueRate(0)).toBe('0%');
  });
});
