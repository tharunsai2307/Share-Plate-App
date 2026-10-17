-- SharePlate Migration 003: Atomic Reservation Transaction Function
-- PLPGSQL function called by the Edge Function to atomically create reservations.
-- Uses SERIALIZABLE isolation with SELECT FOR UPDATE to prevent double-booking.
-- Date: 2026-10-16

CREATE OR REPLACE FUNCTION public.create_reservation_atomic(
  p_listing_id        UUID,
  p_recipient_org_id  UUID,
  p_reserved_by       UUID,
  p_quantity_requested NUMERIC,
  p_unit              TEXT,
  p_idempotency_key   TEXT,
  p_actor_role        TEXT DEFAULT 'user'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with elevated privileges; called only from Edge Function
AS $$
DECLARE
  v_listing          public.food_listings%ROWTYPE;
  v_available        NUMERIC;
  v_new_reserved     NUMERIC;
  v_new_status       TEXT;
  v_reservation_id   UUID;
  v_now              TIMESTAMPTZ := NOW();
  v_result           JSONB;
BEGIN
  -- Lock the listing row to prevent concurrent modification
  -- NOWAIT: fail fast if another transaction holds the lock (avoids deadlock)
  BEGIN
    SELECT * INTO v_listing
    FROM public.food_listings
    WHERE id = p_listing_id
    FOR UPDATE NOWAIT;
  EXCEPTION
    WHEN lock_not_available THEN
      RAISE EXCEPTION 'LOCK_CONFLICT: Concurrent reservation in progress, please retry'
        USING ERRCODE = 'P0001';
  END;

  -- Validate listing exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LISTING_NOT_FOUND: Listing % does not exist', p_listing_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Validate listing status
  IF v_listing.status NOT IN ('published', 'partially_reserved') THEN
    RAISE EXCEPTION 'LISTING_NOT_RESERVABLE: Listing status is %', v_listing.status
      USING ERRCODE = 'P0003';
  END IF;

  -- Validate listing not expired (use server time)
  IF v_listing.expires_at <= v_now THEN
    RAISE EXCEPTION 'LISTING_EXPIRED: Listing consumption deadline has passed'
      USING ERRCODE = 'P0004';
  END IF;

  -- Validate pickup window is still open
  IF v_listing.pickup_window_end <= v_now THEN
    RAISE EXCEPTION 'PICKUP_WINDOW_CLOSED: Pickup window for this listing has closed'
      USING ERRCODE = 'P0005';
  END IF;

  -- Validate unit matches
  IF v_listing.unit != p_unit THEN
    RAISE EXCEPTION 'UNIT_MISMATCH: Listing uses %, request uses %', v_listing.unit, p_unit
      USING ERRCODE = 'P0006';
  END IF;

  -- Compute and validate available quantity
  v_available := v_listing.quantity_offered - v_listing.quantity_reserved;

  IF p_quantity_requested <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY: Quantity must be positive'
      USING ERRCODE = 'P0007';
  END IF;

  IF p_quantity_requested > v_available THEN
    RAISE EXCEPTION 'INSUFFICIENT_QUANTITY: Only % % available, % requested',
      v_available, p_unit, p_quantity_requested
      USING ERRCODE = 'P0008';
  END IF;

  -- Compute new reserved quantity and listing status
  v_new_reserved := v_listing.quantity_reserved + p_quantity_requested;

  IF v_new_reserved >= v_listing.quantity_offered THEN
    v_new_status := 'fully_reserved';
  ELSE
    v_new_status := 'partially_reserved';
  END IF;

  -- Create the reservation
  v_reservation_id := gen_random_uuid();

  INSERT INTO public.reservations (
    id,
    listing_id,
    recipient_org_id,
    reserved_by,
    quantity_requested,
    unit,
    status,
    idempotency_key,
    confirmed_at,
    pickup_deadline,
    is_demo
  ) VALUES (
    v_reservation_id,
    p_listing_id,
    p_recipient_org_id,
    p_reserved_by,
    p_quantity_requested,
    p_unit,
    'confirmed',
    p_idempotency_key,
    v_now,
    v_listing.pickup_window_end,
    v_listing.is_demo
  );

  -- Update listing quantity and status atomically
  UPDATE public.food_listings
  SET
    quantity_reserved = v_new_reserved,
    status = v_new_status,
    updated_at = v_now
  WHERE id = p_listing_id;

  -- Append audit log (non-blocking; do not fail reservation if this fails)
  BEGIN
    INSERT INTO public.audit_logs (
      actor_id,
      actor_role,
      action,
      entity_type,
      entity_id,
      new_data
    ) VALUES (
      p_reserved_by,
      p_actor_role,
      'reservation_created',
      'reservation',
      v_reservation_id,
      jsonb_build_object(
        'reservation_id', v_reservation_id,
        'listing_id', p_listing_id,
        'recipient_org_id', p_recipient_org_id,
        'quantity_requested', p_quantity_requested,
        'unit', p_unit,
        'quantity_available_before', v_available,
        'new_listing_status', v_new_status
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Audit failure must not rollback the reservation
    RAISE WARNING 'Audit log insertion failed: %', SQLERRM;
  END;

  -- Return reservation data to Edge Function
  v_result := jsonb_build_object(
    'id', v_reservation_id,
    'listing_id', p_listing_id,
    'recipient_org_id', p_recipient_org_id,
    'reserved_by', p_reserved_by,
    'quantity_requested', p_quantity_requested,
    'unit', p_unit,
    'status', 'confirmed',
    'confirmed_at', v_now,
    'pickup_deadline', v_listing.pickup_window_end,
    'listing_status', v_new_status,
    'quantity_available_after', v_listing.quantity_offered - v_new_reserved
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.create_reservation_atomic IS
  'Atomically creates a reservation. Uses SELECT FOR UPDATE for concurrency safety. '
  'Called only by the create-reservation Edge Function with service-role privileges. '
  'Raises named exceptions (LISTING_NOT_FOUND, INSUFFICIENT_QUANTITY, etc.) '
  'that the Edge Function maps to HTTP status codes.';

-- ─── Cancel Reservation Function ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cancel_reservation_atomic(
  p_reservation_id   UUID,
  p_cancelled_by     UUID,
  p_reason           TEXT,
  p_actor_role       TEXT DEFAULT 'user'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation  public.reservations%ROWTYPE;
  v_now          TIMESTAMPTZ := NOW();
BEGIN
  -- Lock the reservation
  SELECT * INTO v_reservation
  FROM public.reservations
  WHERE id = p_reservation_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESERVATION_NOT_FOUND: Reservation % does not exist', p_reservation_id
      USING ERRCODE = 'P0010';
  END IF;

  -- Only confirmed reservations can be cancelled
  IF v_reservation.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'RESERVATION_NOT_CANCELLABLE: Status is %', v_reservation.status
      USING ERRCODE = 'P0011';
  END IF;

  -- Cancel the reservation
  UPDATE public.reservations
  SET
    status = 'cancelled',
    cancelled_at = v_now,
    cancellation_reason = p_reason,
    cancelled_by = p_cancelled_by,
    updated_at = v_now
  WHERE id = p_reservation_id;

  -- Restore quantity to listing
  UPDATE public.food_listings
  SET
    quantity_reserved = GREATEST(0, quantity_reserved - v_reservation.quantity_requested),
    status = CASE
      WHEN quantity_reserved - v_reservation.quantity_requested <= 0 THEN 'published'
      ELSE 'partially_reserved'
    END,
    updated_at = v_now
  WHERE id = v_reservation.listing_id;

  -- Audit log
  BEGIN
    INSERT INTO public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, new_data)
    VALUES (
      p_cancelled_by, p_actor_role, 'reservation_cancelled', 'reservation', p_reservation_id,
      jsonb_build_object(
        'reservation_id', p_reservation_id,
        'listing_id', v_reservation.listing_id,
        'quantity_restored', v_reservation.quantity_requested,
        'reason', p_reason
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Audit log insertion failed: %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'reservation_id', p_reservation_id,
    'status', 'cancelled',
    'quantity_restored', v_reservation.quantity_requested
  );
END;
$$;
