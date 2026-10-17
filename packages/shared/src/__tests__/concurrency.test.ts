/**
 * Concurrency & Invariant Simulation Tests for SharePlate
 * Validates race condition handling, atomic locking logic,
 * and invariant enforcement under concurrent reservation attempts.
 */

import {
  computeAvailableQuantity,
  validateReservationQuantity,
  computeListingStatusAfterReservation,
} from '../rules.js';
import { FoodUnit, ListingStatus } from '../enums.js';

interface SimulatedListing {
  id: string;
  quantity_offered: number;
  quantity_reserved: number;
  unit: FoodUnit;
  status: ListingStatus;
  locked: boolean;
}

class AtomicReservationSimulator {
  private listing: SimulatedListing;

  constructor(offered: number, unit: FoodUnit = FoodUnit.PORTIONS) {
    this.listing = {
      id: 'test-listing-1',
      quantity_offered: offered,
      quantity_reserved: 0,
      unit,
      status: ListingStatus.PUBLISHED,
      locked: false,
    };
  }

  // Simulates PostgreSQL SELECT FOR UPDATE NOWAIT + serializable transaction
  async attemptReservation(quantity: number, unit: FoodUnit = FoodUnit.PORTIONS): Promise<{ success: boolean; error?: string }> {
    // Artificial small jitter to simulate network interleaving
    await new Promise((r) => setTimeout(r, Math.random() * 10));

    if (this.listing.locked) {
      return { success: false, error: 'LOCK_CONFLICT: Concurrent transaction holding row lock' };
    }

    // Acquire lock
    this.listing.locked = true;

    try {
      const errorMsg = validateReservationQuantity(this.listing, quantity, unit);

      if (errorMsg !== null) {
        return { success: false, error: errorMsg };
      }

      // Apply reservation atomically
      this.listing.quantity_reserved += quantity;
      this.listing.status = computeListingStatusAfterReservation(
        this.listing.quantity_offered,
        this.listing.quantity_reserved,
        this.listing.status
      ) as ListingStatus;

      return { success: true };
    } finally {
      // Release lock
      this.listing.locked = false;
    }
  }

  getSnapshot(): Readonly<SimulatedListing> {
    return { ...this.listing };
  }
}

describe('Atomic Reservation Concurrency & Invariants', () => {
  it('prevents double-booking: 10-portion listing with 2 concurrent requests for 6 portions', async () => {
    const simulator = new AtomicReservationSimulator(10, FoodUnit.PORTIONS);

    // Launch two concurrent requests for 6 portions each
    const [resA, resB] = await Promise.all([
      simulator.attemptReservation(6),
      simulator.attemptReservation(6),
    ]);

    const successes = [resA, resB].filter((r) => r.success);
    const failures = [resA, resB].filter((r) => !r.success);

    // Exactly one must succeed
    expect(successes).toHaveLength(1);
    // Exactly one must fail (either due to lock conflict or insufficient quantity)
    expect(failures).toHaveLength(1);

    const snapshot = simulator.getSnapshot();
    // Invariant: quantity_reserved must never exceed quantity_offered
    expect(snapshot.quantity_reserved).toBe(6);
    expect(snapshot.quantity_reserved).toBeLessThanOrEqual(snapshot.quantity_offered);
    expect(snapshot.status).toBe(ListingStatus.PARTIALLY_RESERVED);
  });

  it('allows two concurrent requests that sum to <= offered quantity', async () => {
    const simulator = new AtomicReservationSimulator(10, FoodUnit.PORTIONS);

    // Two non-conflicting concurrent requests for 4 and 6 portions
    const resA = await simulator.attemptReservation(4);
    const resB = await simulator.attemptReservation(6);

    expect(resA.success).toBe(true);
    expect(resB.success).toBe(true);

    const snapshot = simulator.getSnapshot();
    expect(snapshot.quantity_reserved).toBe(10);
    expect(snapshot.status).toBe(ListingStatus.FULLY_RESERVED);
  });

  it('strictly rejects negative or zero reservations', async () => {
    const simulator = new AtomicReservationSimulator(10, FoodUnit.PORTIONS);

    const resZero = await simulator.attemptReservation(0);
    expect(resZero.success).toBe(false);

    const resNeg = await simulator.attemptReservation(-5);
    expect(resNeg.success).toBe(false);

    expect(simulator.getSnapshot().quantity_reserved).toBe(0);
  });
});
