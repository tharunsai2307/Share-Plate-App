/**
 * SharePlate — Status Enums
 * Single source of truth for all entity status values.
 * Used in DB CHECK constraints, Zod schemas, and client-side logic.
 */

export const ListingStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  PARTIALLY_RESERVED: 'partially_reserved',
  FULLY_RESERVED: 'fully_reserved',
  PICKUP_IN_PROGRESS: 'pickup_in_progress',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  SUSPENDED: 'suspended',
} as const;

export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus];

export const LISTING_STATUSES = Object.values(ListingStatus);

/** Statuses in which a listing can receive new reservations */
export const RESERVABLE_STATUSES: ListingStatus[] = [
  ListingStatus.PUBLISHED,
  ListingStatus.PARTIALLY_RESERVED,
];

export const ReservationStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  COMPLETED: 'completed',
  DISPUTED: 'disputed',
} as const;

export type ReservationStatus = (typeof ReservationStatus)[keyof typeof ReservationStatus];

export const RESERVATION_STATUSES = Object.values(ReservationStatus);

export const HandoffStatus = {
  PENDING: 'pending',
  CODE_SENT: 'code_sent',
  VERIFIED: 'verified',
  COMPLETED: 'completed',
  PARTIAL: 'partial',
  FAILED: 'failed',
  DISPUTED: 'disputed',
} as const;

export type HandoffStatus = (typeof HandoffStatus)[keyof typeof HandoffStatus];

export const HANDOFF_STATUSES = Object.values(HandoffStatus);

export const PickupAssignmentStatus = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  VERIFIED: 'verified',
  COMPLETED: 'completed',
  PARTIAL: 'partial',
  FAILED: 'failed',
} as const;

export type PickupAssignmentStatus =
  (typeof PickupAssignmentStatus)[keyof typeof PickupAssignmentStatus];

export const OrganizationVerificationStatus = {
  UNVERIFIED: 'unverified',
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
} as const;

export type OrganizationVerificationStatus =
  (typeof OrganizationVerificationStatus)[keyof typeof OrganizationVerificationStatus];

export const AppRole = {
  USER: 'user',
  VOLUNTEER: 'volunteer',
  ADMIN: 'admin',
} as const;

export type AppRole = (typeof AppRole)[keyof typeof AppRole];

export const MemberRole = {
  OWNER: 'owner',
  MANAGER: 'manager',
  MEMBER: 'member',
} as const;

export type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];

export const OrgType = {
  DONOR: 'donor',
  RECIPIENT: 'recipient',
  BOTH: 'both',
} as const;

export type OrgType = (typeof OrgType)[keyof typeof OrgType];

export const FoodCategory = {
  COOKED_MEAL: 'cooked_meal',
  BAKERY: 'bakery',
  PRODUCE: 'produce',
  DAIRY: 'dairy',
  PACKAGED: 'packaged',
  BEVERAGE: 'beverage',
  OTHER: 'other',
} as const;

export type FoodCategory = (typeof FoodCategory)[keyof typeof FoodCategory];

export const FoodUnit = {
  PORTIONS: 'portions',
  KG: 'kg',
  LITRES: 'litres',
  BOXES: 'boxes',
  ITEMS: 'items',
} as const;

export type FoodUnit = (typeof FoodUnit)[keyof typeof FoodUnit];

export const FOOD_UNITS = Object.values(FoodUnit);

export const DietaryFlag = {
  VEGETARIAN: 'vegetarian',
  VEGAN: 'vegan',
  GLUTEN_FREE: 'gluten_free',
  HALAL: 'halal',
  JAIN: 'jain',
  NUT_FREE: 'nut_free',
  DAIRY_FREE: 'dairy_free',
} as const;

export type DietaryFlag = (typeof DietaryFlag)[keyof typeof DietaryFlag];

export const SafetyReportType = {
  FOOD_SAFETY: 'food_safety',
  QUALITY: 'quality',
  QUANTITY_DISPUTE: 'quantity_dispute',
  NO_SHOW: 'no_show',
  FRAUD: 'fraud',
  OTHER: 'other',
} as const;

export type SafetyReportType = (typeof SafetyReportType)[keyof typeof SafetyReportType];

export const VerificationApplicationStatus = {
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type VerificationApplicationStatus =
  (typeof VerificationApplicationStatus)[keyof typeof VerificationApplicationStatus];
