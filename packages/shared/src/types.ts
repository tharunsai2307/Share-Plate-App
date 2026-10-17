/**
 * SharePlate — Domain Type Definitions
 * TypeScript interfaces matching the database schema.
 * All optional DB fields are explicitly typed as T | null.
 */

import type {
  AppRole,
  DietaryFlag,
  FoodCategory,
  FoodUnit,
  HandoffStatus,
  ListingStatus,
  MemberRole,
  OrgType,
  OrganizationVerificationStatus,
  PickupAssignmentStatus,
  ReservationStatus,
  SafetyReportType,
  VerificationApplicationStatus,
} from './enums.js';

// ─── Base ────────────────────────────────────────────────────────────────────

export interface BaseEntity {
  id: string; // UUID
  created_at: string; // ISO 8601 UTC
  updated_at: string; // ISO 8601 UTC
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export interface Profile extends BaseEntity {
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  app_role: AppRole;
  is_active: boolean;
  suspended_at: string | null;
  suspension_reason: string | null;
}

// ─── Organization ─────────────────────────────────────────────────────────────

export interface Organization extends BaseEntity {
  name: string;
  org_type: OrgType;
  description: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  fssai_number: string | null;
  registration_number: string | null;
  verification_status: OrganizationVerificationStatus;
  verified_at: string | null;
  verified_by: string | null; // profile UUID
  suspended_at: string | null;
  suspension_reason: string | null;
  is_demo: boolean;
}

export interface OrganizationMember extends BaseEntity {
  organization_id: string;
  user_id: string;
  member_role: MemberRole;
  is_active: boolean;
  invited_at: string;
  accepted_at: string | null;
}

export interface VerificationApplication extends BaseEntity {
  organization_id: string;
  submitted_by: string; // profile UUID
  status: VerificationApplicationStatus;
  documents: VerificationDocument[];
  notes: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
}

export interface VerificationDocument {
  name: string;
  storage_path: string;
  type: string; // 'registration_cert' | 'fssai_cert' | 'id_proof' | 'other'
}

// ─── Food Listing ─────────────────────────────────────────────────────────────

export interface FoodListing extends BaseEntity {
  donor_org_id: string;
  created_by: string; // profile UUID
  title: string;
  description: string | null;
  category: FoodCategory;
  dietary_flags: DietaryFlag[];
  // Quantity fields — always NUMERIC, represented as number in JS (exact via DB)
  quantity_offered: number;
  quantity_reserved: number;
  quantity_collected: number;
  quantity_accepted: number;
  quantity_distributed: number;
  unit: FoodUnit;
  prepared_at: string; // ISO 8601 UTC
  expires_at: string; // ISO 8601 UTC (consumption deadline)
  allergens: string | null;
  storage_requirements: string | null;
  transport_requirements: string | null;
  pickup_address: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  pickup_window_start: string; // ISO 8601 UTC
  pickup_window_end: string; // ISO 8601 UTC
  status: ListingStatus;
  published_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  photos: string[]; // storage paths
  contact_name: string | null;
  contact_phone: string | null;
  is_demo: boolean;
}

/** Derived field — not stored, always computed */
export interface FoodListingWithAvailability extends FoodListing {
  quantity_available: number;
}

// ─── Reservation ─────────────────────────────────────────────────────────────

export interface Reservation extends BaseEntity {
  listing_id: string;
  recipient_org_id: string;
  reserved_by: string; // profile UUID
  quantity_requested: number;
  unit: FoodUnit;
  status: ReservationStatus;
  idempotency_key: string | null;
  confirmed_at: string;
  pickup_deadline: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null; // profile UUID
  completed_at: string | null;
  is_demo: boolean;
}

// ─── Pickup Assignment ────────────────────────────────────────────────────────

export interface PickupAssignment extends BaseEntity {
  reservation_id: string;
  listing_id: string;
  volunteer_id: string | null; // profile UUID
  status: PickupAssignmentStatus;
  scheduled_at: string | null;
  started_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  notes: string | null;
  is_demo: boolean;
}

// ─── Handoff ─────────────────────────────────────────────────────────────────

export interface Handoff extends BaseEntity {
  assignment_id: string;
  reservation_id: string;
  // verification_code_hash intentionally omitted — never returned to client
  code_expires_at: string | null;
  code_attempts: number;
  code_verified_at: string | null;
  quantity_confirmed: number | null;
  quantity_rejected: number;
  rejection_reason: string | null;
  donor_confirmed_by: string | null; // profile UUID
  recipient_confirmed_by: string | null; // profile UUID
  status: HandoffStatus;
  donor_notes: string | null;
  recipient_notes: string | null;
  is_demo: boolean;
}

// ─── Distribution Record ──────────────────────────────────────────────────────

export interface DistributionRecord extends BaseEntity {
  reservation_id: string;
  recipient_org_id: string;
  recorded_by: string; // profile UUID
  quantity_distributed: number;
  unit: FoodUnit;
  distributed_at: string;
  beneficiary_count: number | null;
  distribution_notes: string | null;
  is_demo: boolean;
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  sent_at: string | null;
  created_at: string;
}

// ─── Device Token ─────────────────────────────────────────────────────────────

export interface DeviceToken extends BaseEntity {
  user_id: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  is_active: boolean;
  last_used_at: string | null;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ─── Safety Report ────────────────────────────────────────────────────────────

export interface SafetyReport extends BaseEntity {
  listing_id: string | null;
  reservation_id: string | null;
  reported_by: string;
  report_type: SafetyReportType;
  description: string;
  status: 'open' | 'under_review' | 'resolved' | 'escalated';
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
}

// ─── App Config ────────────────────────────────────────────────────────────────

export interface AppConfig {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

// ─── Impact Metrics ────────────────────────────────────────────────────────────

export interface ImpactMetrics {
  /** Total food offered across published listings (by unit) */
  food_offered_by_unit: Record<FoodUnit, number>;
  /** Total food reserved with confirmed status */
  food_reserved_by_unit: Record<FoodUnit, number>;
  /** Total food collected from verified handovers */
  food_collected_by_unit: Record<FoodUnit, number>;
  /** Total food accepted by recipients */
  food_accepted_by_unit: Record<FoodUnit, number>;
  /** Total food distributed */
  food_distributed_by_unit: Record<FoodUnit, number>;
  /** Rescue rate: collected / offered for completed+expired listings. null if no eligible listings. */
  rescue_rate: number | null;
  /** Average minutes from listing published_at to handover code_verified_at */
  avg_time_to_pickup_minutes: number | null;
  /** Count of listings that expired without full collection */
  expired_listing_count: number;
  /** Total beneficiary count from distribution records */
  beneficiary_count: number;
  /** Count of active verified donor organizations */
  active_donor_org_count: number;
  /** Count of active verified recipient organizations */
  active_recipient_org_count: number;
  /** Timestamp when metrics were computed */
  computed_at: string;
}
