/**
 * SharePlate — Business Rules
 * Server-enforced invariants and constants.
 * These must mirror the DB CHECK constraints exactly.
 */

import type { FoodListing } from './types.js';
import { RESERVABLE_STATUSES } from './enums.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum OTP attempt count before invalidation */
export const HANDOVER_OTP_MAX_ATTEMPTS = 5;

/** OTP validity in minutes */
export const HANDOVER_OTP_TTL_MINUTES = 30;

/** OTP code length */
export const HANDOVER_OTP_LENGTH = 6;

/** Maximum quantity value enforced in DB and Zod */
export const MAX_QUANTITY = 9_999_999.999;

/** Minimum quantity for any operation */
export const MIN_QUANTITY = 0.001;

/** Maximum photos per listing */
export const MAX_LISTING_PHOTOS = 10;

/** Maximum file size for listing photos (bytes) */
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Maximum file size for verification documents (bytes) */
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Allowed MIME types for listing photos */
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Allowed MIME types for verification documents */
export const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

/** Idempotency key max length */
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

// ─── Quantity Invariants ──────────────────────────────────────────────────────

/**
 * Compute available quantity from listing.
 * This is the AUTHORITATIVE formula used everywhere.
 * Never compute it differently on different screens.
 */
export function computeAvailableQuantity(listing: Pick<FoodListing, 'quantity_offered' | 'quantity_reserved'>): number {
  const available = listing.quantity_offered - listing.quantity_reserved;
  return Math.max(0, Math.round(available * 1000) / 1000);
}

/**
 * Check that a given requested quantity can be reserved against a listing.
 * Returns null if valid, or an error message string if not.
 */
export function validateReservationQuantity(
  listing: Pick<FoodListing, 'quantity_offered' | 'quantity_reserved' | 'unit' | 'status'>,
  requestedQuantity: number,
  requestedUnit: string
): string | null {
  if (!RESERVABLE_STATUSES.includes(listing.status as typeof RESERVABLE_STATUSES[number])) {
    return `Listing is not available for reservation (status: ${listing.status})`;
  }
  if (requestedUnit !== listing.unit) {
    return `Unit mismatch: listing uses '${listing.unit}', request uses '${requestedUnit}'`;
  }
  if (requestedQuantity <= 0) {
    return 'Requested quantity must be positive';
  }
  const available = computeAvailableQuantity(listing);
  if (requestedQuantity > available) {
    return `Only ${available} ${listing.unit} available, ${requestedQuantity} requested`;
  }
  return null;
}

/**
 * Determine new listing status after a reservation is created or cancelled.
 */
export function computeListingStatusAfterReservation(
  quantityOffered: number,
  newQuantityReserved: number,
  currentStatus: string
): string {
  if (newQuantityReserved >= quantityOffered) {
    return 'fully_reserved';
  }
  if (newQuantityReserved > 0) {
    return 'partially_reserved';
  }
  // Restored to published after cancellation
  if (currentStatus === 'partially_reserved' || currentStatus === 'fully_reserved') {
    return 'published';
  }
  return currentStatus;
}

// ─── Deadline Eligibility ─────────────────────────────────────────────────────

/**
 * Check whether a listing's pickup window is still open.
 * Uses provided serverTime (UTC) — NEVER use Date.now() or device time for eligibility.
 */
export function isPickupWindowOpen(
  pickupWindowEnd: string,
  serverTimeUtc: Date
): boolean {
  return new Date(pickupWindowEnd) > serverTimeUtc;
}

/**
 * Check whether a listing has expired (consumption deadline passed).
 */
export function isListingExpired(expiresAt: string, serverTimeUtc: Date): boolean {
  return new Date(expiresAt) <= serverTimeUtc;
}

/**
 * Full eligibility check for a listing to accept new reservations.
 * Returns null if eligible, or a reason string if not.
 */
export function checkListingEligibility(
  listing: Pick<FoodListing, 'status' | 'expires_at' | 'pickup_window_end'>,
  serverTimeUtc: Date
): string | null {
  if (!RESERVABLE_STATUSES.includes(listing.status as typeof RESERVABLE_STATUSES[number])) {
    return `Listing status '${listing.status}' is not reservable`;
  }
  if (isListingExpired(listing.expires_at, serverTimeUtc)) {
    return 'Listing has expired (past consumption deadline)';
  }
  if (!isPickupWindowOpen(listing.pickup_window_end, serverTimeUtc)) {
    return 'Pickup window has closed';
  }
  return null;
}

// ─── Impact Metrics ───────────────────────────────────────────────────────────

/**
 * Safe division returning null when denominator is zero.
 * Used for rescue_rate and similar ratios.
 */
export function safeRatio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 10000) / 10000; // 4 decimal precision
}

/**
 * Format a ratio as a percentage string.
 * Returns 'N/A' when ratio is null (no eligible data).
 */
export function formatRescueRate(rate: number | null): string {
  if (rate === null) return 'N/A';
  return `${Math.round(rate * 100)}%`;
}

// ─── State Machine Helpers ────────────────────────────────────────────────────

/** Actors who may perform each listing transition */
export const LISTING_TRANSITION_ACTORS: Record<string, string[]> = {
  'draft→published': ['donor_member', 'admin'],
  'draft→cancelled': ['donor_member', 'admin'],
  'published→cancelled': ['donor_member', 'admin'],
  'published→suspended': ['admin'],
  'suspended→published': ['admin'],
  'suspended→cancelled': ['admin'],
  // Quantity-driven transitions happen in server transaction only
  'published→partially_reserved': ['system'],
  'published→fully_reserved': ['system'],
  'partially_reserved→fully_reserved': ['system'],
  'partially_reserved→pickup_in_progress': ['system'],
  'fully_reserved→pickup_in_progress': ['system'],
  'pickup_in_progress→completed': ['system'],
  'pickup_in_progress→expired': ['system'],
  'partially_reserved→expired': ['system'],
  'published→expired': ['system'],
};
