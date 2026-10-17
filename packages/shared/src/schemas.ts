/**
 * SharePlate — Zod Validation Schemas
 * All inputs validated here before any database operation.
 * These schemas are the authoritative source for input validation.
 */

import { z } from 'zod';
import {
  FoodCategory,
  FoodUnit,
  DietaryFlag,
  ListingStatus,
  LISTING_STATUSES,
  FOOD_UNITS,
  OrgType,
  SafetyReportType,
} from './enums.js';

// ─── Shared primitives ───────────────────────────────────────────────────────

export const UUIDSchema = z.string().uuid('Must be a valid UUID');

export const ISO8601Schema = z.string().datetime({ message: 'Must be a valid ISO 8601 datetime' });

/** Positive quantity with 3 decimal precision maximum. Max ~9.9 million. */
export const QuantitySchema = z
  .number()
  .positive('Quantity must be positive')
  .max(9_999_999.999, 'Quantity exceeds maximum')
  .refine((v) => Math.round(v * 1000) / 1000 === v, 'Maximum 3 decimal places');

export const FoodUnitSchema = z.enum(FOOD_UNITS as [FoodUnit, ...FoodUnit[]]);

export const PhoneSchema = z
  .string()
  .min(10)
  .max(15)
  .regex(/^\+?[0-9\s\-()]+$/, 'Invalid phone number format');

export const IdempotencyKeySchema = z.string().min(1).max(128);

// ─── Profile ─────────────────────────────────────────────────────────────────

export const UpdateProfileSchema = z.object({
  full_name: z.string().min(1).max(200).trim(),
  phone: PhoneSchema.optional(),
  avatar_url: z.string().url().max(2048).optional(),
});

// ─── Organization ─────────────────────────────────────────────────────────────

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2).max(200).trim(),
  org_type: z.nativeEnum(OrgType),
  description: z.string().max(2000).trim().optional(),
  address_line1: z.string().max(300).trim().optional(),
  address_line2: z.string().max(300).trim().optional(),
  city: z.string().min(1).max(100).trim(),
  state: z.string().min(1).max(100).trim(),
  pincode: z
    .string()
    .regex(/^\d{6}$/, 'Pincode must be 6 digits')
    .optional(),
  phone: PhoneSchema.optional(),
  email: z.string().email().max(320).optional(),
  website: z.string().url().max(2048).optional(),
  fssai_number: z.string().max(100).trim().optional(),
  registration_number: z.string().max(100).trim().optional(),
});

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;

// ─── Food Listing ─────────────────────────────────────────────────────────────

const FoodCategorySchema = z.nativeEnum(FoodCategory);
const DietaryFlagSchema = z.nativeEnum(DietaryFlag);

const FoodListingBaseSchema = z.object({

    donor_org_id: UUIDSchema,
    title: z.string().min(3).max(200).trim(),
    description: z.string().max(2000).trim().optional(),
    category: FoodCategorySchema,
    dietary_flags: z.array(DietaryFlagSchema).max(10).default([]),
    quantity_offered: QuantitySchema,
    unit: FoodUnitSchema,
    prepared_at: ISO8601Schema,
    expires_at: ISO8601Schema,
    allergens: z.string().max(1000).trim().optional(),
    storage_requirements: z.string().max(500).trim().optional(),
    transport_requirements: z.string().max(500).trim().optional(),
    pickup_address: z.string().min(5).max(500).trim(),
    pickup_latitude: z.number().min(-90).max(90).optional(),
    pickup_longitude: z.number().min(-180).max(180).optional(),
    pickup_window_start: ISO8601Schema,
    pickup_window_end: ISO8601Schema,
    contact_name: z.string().max(200).trim().optional(),
    contact_phone: PhoneSchema.optional(),
  });

export const CreateFoodListingSchema = FoodListingBaseSchema
  .refine(
    (data) => new Date(data.expires_at) > new Date(data.prepared_at),
    { message: 'expires_at must be after prepared_at', path: ['expires_at'] }
  )
  .refine(
    (data) => new Date(data.pickup_window_end) > new Date(data.pickup_window_start),
    {
      message: 'pickup_window_end must be after pickup_window_start',
      path: ['pickup_window_end'],
    }
  )
  .refine(
    (data) => new Date(data.pickup_window_end) > new Date(),
    { message: 'Pickup window must be in the future', path: ['pickup_window_end'] }
  );

export type CreateFoodListingInput = z.infer<typeof CreateFoodListingSchema>;

export const UpdateFoodListingSchema = FoodListingBaseSchema.partial().omit({
  donor_org_id: true,
});

export type UpdateFoodListingInput = z.infer<typeof UpdateFoodListingSchema>;


export const PublishListingSchema = z.object({
  listing_id: UUIDSchema,
});

export const CancelListingSchema = z.object({
  listing_id: UUIDSchema,
  reason: z.string().min(5).max(500).trim(),
});

// ─── Reservation ─────────────────────────────────────────────────────────────

export const CreateReservationSchema = z.object({
  listing_id: UUIDSchema,
  quantity_requested: QuantitySchema,
  unit: FoodUnitSchema,
  idempotency_key: IdempotencyKeySchema,
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

export const CancelReservationSchema = z.object({
  reservation_id: UUIDSchema,
  reason: z.string().min(5).max(500).trim(),
});

// ─── Handover ─────────────────────────────────────────────────────────────────

export const GenerateHandoverCodeSchema = z.object({
  assignment_id: UUIDSchema,
});

export const VerifyHandoverCodeSchema = z.object({
  handoff_id: UUIDSchema,
  code: z.string().length(6).regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
});

export const RecordHandoverQuantitySchema = z.object({
  handoff_id: UUIDSchema,
  quantity_confirmed: QuantitySchema,
  quantity_rejected: z.number().min(0).max(9_999_999.999).default(0),
  rejection_reason: z.string().max(500).optional(),
  donor_notes: z.string().max(500).optional(),
  recipient_notes: z.string().max(500).optional(),
});

// ─── Distribution ─────────────────────────────────────────────────────────────

export const RecordDistributionSchema = z.object({
  reservation_id: UUIDSchema,
  quantity_distributed: QuantitySchema,
  unit: FoodUnitSchema,
  distributed_at: ISO8601Schema,
  beneficiary_count: z.number().int().positive().max(1_000_000).optional(),
  distribution_notes: z.string().max(1000).trim().optional(),
});

export type RecordDistributionInput = z.infer<typeof RecordDistributionSchema>;

// ─── Safety Report ────────────────────────────────────────────────────────────

export const CreateSafetyReportSchema = z.object({
  listing_id: UUIDSchema.optional(),
  reservation_id: UUIDSchema.optional(),
  report_type: z.nativeEnum(SafetyReportType),
  description: z.string().min(20).max(2000).trim(),
});

// ─── Admin Operations ─────────────────────────────────────────────────────────

export const ApproveOrganizationSchema = z.object({
  application_id: UUIDSchema,
  review_notes: z.string().max(1000).trim().optional(),
});

export const RejectOrganizationSchema = z.object({
  application_id: UUIDSchema,
  review_notes: z.string().min(10).max(1000).trim(),
});

export const SuspendOrganizationSchema = z.object({
  organization_id: UUIDSchema,
  reason: z.string().min(10).max(500).trim(),
});

export const SuspendListingSchema = z.object({
  listing_id: UUIDSchema,
  reason: z.string().min(10).max(500).trim(),
});

// ─── Listing Status Transition Validation ─────────────────────────────────────

/**
 * Valid listing status transitions.
 * Key: current status → Value: allowed next statuses.
 */
export const LISTING_TRANSITIONS: Record<string, string[]> = {
  draft: ['published', 'cancelled'],
  published: ['partially_reserved', 'fully_reserved', 'expired', 'cancelled', 'suspended'],
  partially_reserved: ['fully_reserved', 'pickup_in_progress', 'expired', 'cancelled', 'suspended'],
  fully_reserved: ['pickup_in_progress', 'expired', 'cancelled', 'suspended'],
  pickup_in_progress: ['completed', 'expired', 'suspended'],
  completed: [], // terminal
  expired: [], // terminal
  cancelled: [], // terminal
  suspended: ['published', 'cancelled'], // admin can reinstate or cancel
};

export function isValidListingTransition(from: string, to: string): boolean {
  return (LISTING_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * Valid reservation status transitions.
 * Key: current status → Value: allowed next statuses.
 */
export const RESERVATION_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['cancelled', 'expired', 'completed', 'disputed'],
  cancelled: [], // terminal
  expired: [], // terminal
  completed: [], // terminal
  disputed: ['completed', 'cancelled'], // admin resolution
};

export function isValidReservationTransition(from: string, to: string): boolean {
  return (RESERVATION_TRANSITIONS[from] ?? []).includes(to);
}

// ─── Listing Status Schema ────────────────────────────────────────────────────

export const ListingStatusSchema = z.enum(LISTING_STATUSES as [ListingStatus, ...ListingStatus[]]);

// ─── Filters ──────────────────────────────────────────────────────────────────

export const ListListingsFiltersSchema = z.object({
  status: ListingStatusSchema.optional(),
  category: FoodCategorySchema.optional(),
  unit: FoodUnitSchema.optional(),
  city: z.string().max(100).optional(),
  search: z.string().max(200).optional(),
  page: z.number().int().positive().default(1),
  per_page: z.number().int().min(1).max(100).default(20),
});

export type ListListingsFilters = z.infer<typeof ListListingsFiltersSchema>;
