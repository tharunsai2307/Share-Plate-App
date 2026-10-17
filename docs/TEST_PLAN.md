# SharePlate — Test Plan

**Version:** 0.1.0
**Date:** 2026-10-16

---

## A. Unit Tests (packages/shared + Edge Functions)

### Quantity Logic
- quantity_available() returns quantity_offered - quantity_reserved
- quantity_available() never returns negative
- Reservation cannot exceed available quantity
- Partial cancellation correctly restores availability
- Different units are not compared or added

### State Machine
- Valid transitions accepted for each status
- Invalid transitions rejected with descriptive error
- Completed handover cannot be reverted to reserved
- Expired listing cannot receive new reservation

### Deadline Eligibility
- Listing with pickup_window_end in past is ineligible
- Server time used, not client-provided time
- DST-edge case: listing expiring at 02:00 on DST transition handled correctly

### Role/Permission Helpers
- user with app_role='admin' passes admin check
- user with app_role='user' fails admin check
- org member with member_role='owner' passes owner check
- org member with member_role='member' fails manager check
- suspended user fails all permission checks

### Input Schemas (Zod)
- Valid reservation payload accepted
- quantity <= 0 rejected
- Unknown status value rejected
- Past pickup_window_end rejected at creation time
- Oversized file rejected

### Impact Metrics
- rescue_rate = 0 when quantity_offered = 0 (denominator guard)
- rescue_rate computed only from completed/expired listings
- Demo-flagged records excluded from real totals
- avg_time_to_pickup correctly handles empty set

---

## B. Database and Integration Tests

### RLS Authorization
- Anonymous user cannot read food_listings (non-public)
- Authenticated user from different org cannot read draft listing
- Recipient org member can read published listing
- Admin can read all listings
- Donor org member cannot read another org's draft
- Unauthorized INSERT into reservations rejected

### Organization Membership
- User not in org cannot create listing for that org
- Suspended org member cannot create listing
- Owner can add members; member cannot add members

### Organization Verification
- Unverified org cannot publish listings
- Admin can approve verification application
- Approval sets org.verification_status = 'verified' + audit log entry

### Reservation Transaction
- Successful reservation decrements available quantity atomically
- Failed step rolls back all changes
- Duplicate idempotency_key returns original result
- Different payload with same idempotency_key rejected

### Concurrent Reservations (CRITICAL)
- 10-portion listing + 2 concurrent requests for 6 portions each
- Only first succeeds; second gets conflict response
- Total reserved quantity never exceeds 10
- No partial write visible

### Cancellation
- Cancellation restores correct quantity to listing
- Cancelled reservation cannot be cancelled again
- Quantity restored exactly once (idempotent)

### Listing Expiration
- Server-side expiry process transitions status correctly
- Expired listing cannot be reserved even before cron runs
- Eligibility re-checked at reservation creation time

### Partial Pickup
- Partial quantity recorded correctly
- Remaining quantity disposition documented
- Impact metrics reflect partial, not full

### Handover OTP
- Code generated server-side, never returned in API response
- Correct code verifies successfully
- Incorrect code increments attempt counter
- After 5 attempts, code invalidated
- Code expires after 30 minutes
- Verified code cannot be reused (replay prevention)
- Verification updates handoff status atomically

### Audit Records
- Every reservation creation generates audit log entry
- Admin approval generates audit log entry
- Audit log entries cannot be deleted or updated by client

---

## C. Critical Concurrency Test

**Setup:** Create food_listing with quantity_offered=10, unit='portions', status='published'.

**Execution:** Simultaneously send:
- Request A: create_reservation for 6 portions
- Request B: create_reservation for 6 portions

**Assertions:**
1. Exactly one request returns HTTP 200 with status='confirmed'
2. Other request returns HTTP 409 with meaningful conflict message
3. SELECT quantity_reserved FROM food_listings WHERE id=? returns exactly 6
4. SELECT COUNT(*) FROM reservations WHERE listing_id=? AND status='confirmed' returns exactly 1
5. audit_logs contains exactly one reservation_created entry for this listing
6. No partial writes exist (no reservation with status='pending' left dangling)

**Idempotency test:**
- Retry the successful request with same idempotency_key and same payload
- Assert: returns same reservation_id, status='confirmed', quantity_reserved unchanged

---

## D. Mobile Tests (React Native Testing Library)

- Authentication: sign up, sign in, sign out, session persistence
- Role-specific navigation: donor vs NGO home screens differ
- Form validation: empty required fields, quantity <= 0, past dates
- Listing creation: draft -> publish flow
- Reservation: discover, select portions, confirm
- Failed network: mutation shows error, does not show success
- Duplicate tap: second tap disabled during pending mutation
- Stale availability: UI re-fetches before submitting reservation
- Realtime: listing quantity update received and displayed
- Offline: cached data shown with offline indicator
- Reconnect: fresh data fetched, pending actions reconciled
- Notification denial: app remains functional, no crash

---

## E. Web Admin Tests (Playwright)

- Protected route redirects unauthenticated user to login
- Admin can approve verification application
- Admin cannot approve without valid session (server check)
- Listing moderation: suspend/unsuspend updates DB + audit
- Reservation inspection: filters work correctly
- Audit log: timestamp filter returns correct entries
- Unauthorized: non-admin user receives 403 on admin API
- Empty state: no listings shows correct empty state, not error
- Responsive: key pages usable at 375px and 1440px

---

## F. End-to-End Acceptance Test

Using two separate authenticated test accounts (DonorOrg and NGO, both verified):

1. Donor creates listing for 25 portions, publishes it
2. NGO discovers listing in available list
3. NGO reserves 20 portions — server confirms
4. Donor's active listing shows 5 remaining
5. A second NGO attempts to reserve 10 portions — rejected (only 5 available)
6. Admin assigns volunteer to pickup
7. Donor generates handover OTP
8. Volunteer enters OTP — verified
9. Volunteer records 18 collected (2 rejected)
10. NGO confirms 18 accepted
11. NGO records 18 distributed to 60 beneficiaries
12. Impact dashboard shows:
    - Food collected: 18 portions
    - Rescue rate: 18/25 = 72%
    - Beneficiaries reached: 60
13. An unauthenticated request to GET /reservations/{id} returns 401
14. A different authenticated user (not party to this reservation) gets 403

All steps use real test Supabase environment, not mocked responses.

---

## G. Update Compatibility Tests

- Compatible OTA update received by installed test build without binary change
- Incompatible runtime update NOT applied to mismatched runtime version
- Failed update falls back gracefully to previous bundle
- New native dependency triggers build requirement documentation
- Backend migration with additive column does not break previous client version

---

## H. Definition of Done

A phase is complete when:
- [ ] ESLint passes with zero errors
- [ ] TypeScript strict compilation succeeds
- [ ] All relevant unit tests pass
- [ ] All relevant integration tests pass
- [ ] Affected application builds successfully
- [ ] No known critical regression
- [ ] PROGRESS.md updated with actual results
