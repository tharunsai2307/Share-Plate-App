// SharePlate Edge Function: create-reservation
// Atomically creates a reservation for an NGO.
// Uses SERIALIZABLE transaction with SELECT FOR UPDATE to prevent double-booking.
// This function runs with the SERVICE ROLE key — it bypasses RLS intentionally.
// All authorization is performed explicitly within this function.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://esm.sh/zod@3.23.8';

// ─── Types ────────────────────────────────────────────────────────────────────

const RequestSchema = z.object({
  listing_id: z.string().uuid(),
  quantity_requested: z.number().positive().max(9_999_999.999),
  unit: z.enum(['portions', 'kg', 'litres', 'boxes', 'items']),
  idempotency_key: z.string().min(1).max(128),
});

type ReservationRequest = z.infer<typeof RequestSchema>;

// ─── Constants ────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json',
};

// ─── Response Helpers ─────────────────────────────────────────────────────────

function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data }), { status, headers: JSON_HEADERS });
}

function err(message: string, status: number, code?: string): Response {
  return new Response(
    JSON.stringify({ ok: false, error: message, code: code ?? 'ERROR' }),
    { status, headers: JSON_HEADERS }
  );
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return err('Method not allowed', 405);
  }

  // ── 1. Authenticate the caller ──────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return err('Missing or invalid Authorization header', 401, 'UNAUTHORIZED');
  }

  const userJwt = authHeader.replace('Bearer ', '');

  // Create a user-scoped client to verify the JWT
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return err('Unauthorized', 401, 'UNAUTHORIZED');
  }

  const userId = user.id;

  // ── 2. Parse and validate request body ─────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err('Invalid JSON body', 400, 'INVALID_JSON');
  }

  const parseResult = RequestSchema.safeParse(body);
  if (!parseResult.success) {
    return err(parseResult.error.errors[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR');
  }

  const { listing_id, quantity_requested, unit, idempotency_key }: ReservationRequest =
    parseResult.data;

  // ── Use service-role client for all privileged DB operations ────────────────
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ── 3. Check idempotency — return existing reservation if key exists ────────
  const { data: existingReservation } = await adminClient
    .from('reservations')
    .select('id, status, quantity_requested, unit, listing_id, recipient_org_id')
    .eq('idempotency_key', idempotency_key)
    .maybeSingle();

  if (existingReservation) {
    // Validate payload matches the original request
    if (
      existingReservation.listing_id !== listing_id ||
      existingReservation.quantity_requested !== quantity_requested ||
      existingReservation.unit !== unit
    ) {
      return err(
        'Idempotency key reused with different payload',
        409,
        'IDEMPOTENCY_CONFLICT'
      );
    }
    // Return the original result
    return ok({ reservation: existingReservation, idempotent: true });
  }

  // ── 4. Verify user profile is active ────────────────────────────────────────
  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, app_role, is_active')
    .eq('id', userId)
    .single();

  if (!profile?.is_active) {
    return err('Account is suspended or not found', 403, 'ACCOUNT_SUSPENDED');
  }

  // ── 5. Verify user belongs to a verified recipient organization ─────────────
  const { data: membership } = await adminClient
    .from('organization_members')
    .select('organization_id, member_role, organizations!inner(id, verification_status, org_type)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .filter('organizations.verification_status', 'eq', 'verified')
    .filter('organizations.org_type', 'in', '("recipient","both")')
    .maybeSingle();

  if (!membership) {
    return err(
      'You must be a member of a verified recipient organization to make reservations',
      403,
      'NOT_RECIPIENT_MEMBER'
    );
  }

  const recipientOrgId = membership.organization_id;

  // ── 6. Begin atomic transaction: SELECT FOR UPDATE + INSERT ─────────────────
  // Supabase JS doesn't expose raw transactions directly.
  // We use a PostgreSQL function for the atomic operation.
  const { data: txResult, error: txError } = await adminClient.rpc(
    'create_reservation_atomic',
    {
      p_listing_id: listing_id,
      p_recipient_org_id: recipientOrgId,
      p_reserved_by: userId,
      p_quantity_requested: quantity_requested,
      p_unit: unit,
      p_idempotency_key: idempotency_key,
      p_actor_role: profile.app_role,
    }
  );

  if (txError) {
    // Interpret DB-raised exceptions
    const msg = txError.message ?? '';
    if (msg.includes('LISTING_NOT_FOUND')) {
      return err('Listing not found', 404, 'LISTING_NOT_FOUND');
    }
    if (msg.includes('LISTING_NOT_RESERVABLE')) {
      return err('Listing is not available for reservation', 409, 'LISTING_NOT_RESERVABLE');
    }
    if (msg.includes('LISTING_EXPIRED')) {
      return err('Listing has expired', 409, 'LISTING_EXPIRED');
    }
    if (msg.includes('PICKUP_WINDOW_CLOSED')) {
      return err('Pickup window has closed', 409, 'PICKUP_WINDOW_CLOSED');
    }
    if (msg.includes('INSUFFICIENT_QUANTITY')) {
      return err('Insufficient quantity available', 409, 'INSUFFICIENT_QUANTITY');
    }
    if (msg.includes('UNIT_MISMATCH')) {
      return err('Unit mismatch: reservation unit does not match listing unit', 422, 'UNIT_MISMATCH');
    }
    console.error('Transaction error:', txError);
    return err('Failed to create reservation', 500, 'TRANSACTION_ERROR');
  }

  return ok({ reservation: txResult }, 201);
});
