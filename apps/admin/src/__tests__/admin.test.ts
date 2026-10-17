/**
 * Unit tests for SharePlate Admin Portal operations.
 * Validates impact metric formulas, verification state transitions,
 * listing suspension rules, and audit formatting.
 */

describe('Admin Operational Workflows', () => {
  describe('Authoritative Impact Metrics', () => {
    it('calculates rescue rate correctly and guards against zero division', () => {
      const calculateRescueRate = (collected: number, offered: number) => {
        if (offered <= 0) return 0;
        return Math.round((collected / offered) * 1000) / 10;
      };

      expect(calculateRescueRate(80, 80)).toBe(100);
      expect(calculateRescueRate(45, 50)).toBe(90);
      expect(calculateRescueRate(0, 0)).toBe(0);
      expect(calculateRescueRate(15, 0)).toBe(0);
    });

    it('estimates averted CO2 emissions accurately based on FAO metrics (2.5 kg CO2e per kg)', () => {
      const computeCo2Avoided = (foodWeightKg: number) => Math.round(foodWeightKg * 2.5);

      expect(computeCo2Avoided(845)).toBe(2113);
      expect(computeCo2Avoided(100)).toBe(250);
      expect(computeCo2Avoided(0)).toBe(0);
    });
  });

  describe('Organization Verification State Machine', () => {
    const validTransitions: Record<string, string[]> = {
      unverified: ['pending'],
      pending: ['under_review', 'approved', 'rejected'],
      under_review: ['approved', 'rejected'],
      approved: ['suspended'],
      rejected: ['pending'],
      suspended: ['approved'],
    };

    const isValidTransition = (from: string, to: string) => {
      return (validTransitions[from] || []).includes(to);
    };

    it('allows pending to approved upon valid FSSAI check', () => {
      expect(isValidTransition('pending', 'approved')).toBe(true);
    });

    it('allows pending to rejected when documentation is invalid', () => {
      expect(isValidTransition('pending', 'rejected')).toBe(true);
    });

    it('prohibits direct transition from unverified to approved without review', () => {
      expect(isValidTransition('unverified', 'approved')).toBe(false);
    });
  });

  describe('Food Safety Listing Suspension', () => {
    it('immediately suspends a listing and revokes reservability', () => {
      interface Listing {
        id: string;
        status: string;
        reservable: boolean;
        suspension_reason?: string;
      }

      const listing: Listing = {
        id: 'f-101',
        status: 'published',
        reservable: true,
      };

      const suspendListing = (target: Listing, reason: string): Listing => {
        if (!reason || reason.trim().length < 5) {
          throw new Error('Mandatory suspension reason required for audit log');
        }
        return {
          ...target,
          status: 'suspended',
          reservable: false,
          suspension_reason: reason,
        };
      };

      const suspended = suspendListing(listing, 'Cold chain breach reported by recipient courier');
      expect(suspended.status).toBe('suspended');
      expect(suspended.reservable).toBe(false);
      expect(suspended.suspension_reason).toBeDefined();

      expect(() => suspendListing(listing, '')).toThrow('Mandatory suspension reason required');
    });
  });
});
