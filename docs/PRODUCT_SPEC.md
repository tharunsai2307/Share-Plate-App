# SharePlate — Product Specification

**Version:** 0.1.0
**Date:** 2026-10-16
**Status:** Draft — Phase A Foundation

---

## Mission

Connect surplus food from verified donors to organizations that can collect and distribute it safely.

> **Tagline:** "Good food deserves another destination."

## SDG Alignment

| SDG | Goal |
|-----|------|
| SDG 2 | Zero Hunger |
| SDG 12 | Responsible Consumption and Production |

---

## Target Users

| Role | Description |
|------|-------------|
| **Donor** | Restaurants, bakeries, hostels, caterers, institutional kitchens with surplus food |
| **Recipient (NGO)** | Verified NGOs and community kitchens that collect and distribute food |
| **Volunteer** | Authorized users assigned to pickup/collection tasks |
| **Administrator** | Trusted platform operators with elevated backend access |

---

## Core Workflow

```
Create listing
  -> validate listing (donor)
  -> publish (donor)
  -> discover (NGO)
  -> reserve (NGO, atomic server transaction)
  -> confirm reservation
  -> coordinate pickup (assign volunteer)
  -> verify handover (OTP/code)
  -> confirm receipt (NGO)
  -> record distribution (NGO)
  -> calculate verified impact
```

Every stage has an explicit state transition, enforced on the server.

---

## Food Listing Lifecycle

### Listing Statuses

| Status | Description |
|--------|-------------|
| `draft` | Saved but not yet published |
| `published` | Active and visible to NGOs |
| `partially_reserved` | Some portions reserved, remainder still available |
| `fully_reserved` | All portions reserved |
| `pickup_in_progress` | At least one pickup has begun |
| `completed` | All food collected and confirmed |
| `expired` | Past deadline with no pickup or incomplete pickup |
| `cancelled` | Withdrawn by donor or admin |
| `suspended` | Taken down for safety review |

### Reservation Statuses

| Status | Description |
|--------|-------------|
| `pending` | Created, awaiting donor acknowledgment (MVP: auto-confirmed) |
| `confirmed` | Server-confirmed, pickup coordinated |
| `cancelled` | Cancelled by NGO, donor, or admin |
| `expired` | Not picked up within window |
| `completed` | Pickup and handover verified |
| `disputed` | Quantity or condition disagreement |

### Handover Statuses

| Status | Description |
|--------|-------------|
| `scheduled` | Pickup assigned |
| `in_progress` | Volunteer en route or on site |
| `verified` | OTP/code verified, quantities agreed |
| `completed` | Recipient confirmed receipt |
| `partial` | Only some quantity accepted |
| `failed` | No-show, safety rejection, or dispute |

---

## Quantity Model

All quantities are non-negative integers or decimals with explicit units. Units are tracked per listing.

### Invariants (enforced server-side)

```
quantity_reserved    <= quantity_offered
quantity_collected   <= quantity_reserved  (or authorized exception)
quantity_accepted    <= quantity_collected
quantity_distributed <= quantity_accepted
```

### Supported Units

| Unit | Use Case |
|------|----------|
| `portions` | Prepared meals, packaged items |
| `kg` | Bulk raw or packaged goods by weight |
| `litres` | Liquids |
| `boxes` | Sealed containers |
| `items` | Discrete packaged goods |

Units are never mixed. Reservations must use the same unit as the listing.

---

## MVP Policy Decisions

1. **Reservation confirmation:** Immediately confirmed by the server atomically. No donor-approval step in MVP.
2. **Pickup window:** Donors set a window (start and end datetime). Server enforces eligibility.
3. **Handover verification:** One-time 6-digit numeric code, server-generated, short-lived (30 minutes), single-use.
4. **Organization verification:** Manual admin review of verification application. No automated KYC in MVP.
5. **Geospatial:** Distance-based discovery based on stored coordinates. Full map view in Phase C+.
6. **Unit compatibility:** MVP enforces same unit; cross-unit conversions not permitted.

---

## Food Safety Requirements (FSSAI-aligned)

Captured per listing:
- Preparation/packing datetime
- Consumption deadline
- Allergen list (free-text + structured flags)
- Storage conditions
- Transportation requirements
- FSSAI registration number of donor (where applicable)

Safety interventions:
- Donor or admin can suspend a listing
- Recipients can file a safety complaint
- Admin can suspend an organization
- All safety events recorded in audit log

**Disclaimer:** The platform records food safety information provided by donors. It does not certify or independently verify food safety. Operational food safety compliance is the responsibility of the donor organization and must be reviewed by a qualified food safety professional before real-world deployment.

---

## Impact Metrics (Authoritative Definitions)

| Metric | Definition |
|--------|------------|
| Food Offered | Sum of quantity_offered across published listings (unit-specific) |
| Food Reserved | Sum of quantity_reserved for confirmed reservations |
| Food Collected | Sum of quantity_collected from verified handovers |
| Food Accepted | Sum of quantity_accepted from recipient confirmations |
| Food Distributed | Sum of quantity_distributed from distribution records |
| Rescue Rate | quantity_collected / quantity_offered for completed or expired listings |
| Avg Time to Pickup | Mean of (handover_verified_at - listing_published_at) for completed handovers |
| Expired Listings | Count of listings with status = expired |

Metrics are always computed from authoritative records. Seed/demo data is excluded from real impact totals via is_demo flag.
