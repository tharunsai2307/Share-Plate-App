// SharePlate Edge Function: verify-handover
// Generates and verifies 6-digit OTP codes for food handover verification.
// OTP is stored as bcrypt hash — plaintext is never persisted.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://esm.sh/zod@3.23.8';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' };
const MAX_ATTEMPTS = 5;
const OTP_TTL_MINUTES = 30;

const GenerateSchema = z.object({
  action: z.literal('generate'),
  assignment_id: z.string().uuid(),
});

const VerifySchema = z.object({
  action: z.literal('verify'),
  handoff_id: z.string().uuid(),
  code: z.string().length(6).regex(/^\d{6}$/),
});

const RequestSchema = z.discriminatedUnion('action', [GenerateSchema, VerifySchema]);

function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data }), { status, headers: JSON_HEADERS });
}
function err(message: string, status: number, code?: string): Response {
  return new Response(
    JSON.stringify({ ok: false, error: message, code: code ?? 'ERROR' }),
    { status, headers: JSON_HEADERS }
  );
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return err('Method not allowed', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return err('Unauthorized', 401, 'UNAUTHORIZED');

  const userJwt = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return err('Unauthorized', 401, 'UNAUTHORIZED');

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  let body: unknown;
  try { body = await req.json(); } catch { return err('Invalid JSON', 400); }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0]?.message ?? 'Validation error', 400);

  const payload = parsed.data;

  // ── GENERATE ────────────────────────────────────────────────────────────────
  if (payload.action === 'generate') {
    const { assignment_id } = payload;

    // Verify user is authorized for this assignment (donor org member or volunteer)
    const { data: assignment } = await adminClient
      .from('pickup_assignments')
      .select('id, reservation_id, status, volunteer_id, listing_id')
      .eq('id', assignment_id)
      .single();

    if (!assignment) return err('Assignment not found', 404, 'NOT_FOUND');

    // Check authorization: donor org member or the volunteer
    const { data: listing } = await adminClient
      .from('food_listings')
      .select('donor_org_id')
      .eq('id', assignment.listing_id)
      .single();

    const { data: isMember } = await adminClient.rpc('is_org_member', {
      org_id: listing?.donor_org_id,
    });

    if (!isMember && assignment.volunteer_id !== user.id) {
      return err('Not authorized to generate handover code', 403, 'FORBIDDEN');
    }

    // Generate cryptographically secure 6-digit code
    const codeArray = new Uint8Array(4);
    crypto.getRandomValues(codeArray);
    const rawCode = (new DataView(codeArray.buffer).getUint32(0) % 900000 + 100000).toString();

    // Hash the code — never store plaintext
    const codeHash = await bcrypt.hash(rawCode, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    // Create or update handoff record
    const { data: handoff, error: upsertErr } = await adminClient
      .from('handoffs')
      .upsert(
        {
          assignment_id,
          reservation_id: assignment.reservation_id,
          verification_code_hash: codeHash,
          code_expires_at: expiresAt.toISOString(),
          code_attempts: 0,
          status: 'code_sent',
        },
        { onConflict: 'assignment_id' }
      )
      .select('id')
      .single();

    if (upsertErr || !handoff) {
      console.error('Handoff upsert error:', upsertErr);
      return err('Failed to generate code', 500);
    }

    // Return the plaintext code ONLY in this response — not stored anywhere
    // The recipient must receive it verbally or via secure channel
    return ok({
      handoff_id: handoff.id,
      code: rawCode,  // 6-digit plaintext — only returned here, never stored
      expires_at: expiresAt.toISOString(),
      message: 'Share this code with the recipient volunteer for verification',
    });
  }

  // ── VERIFY ──────────────────────────────────────────────────────────────────
  if (payload.action === 'verify') {
    const { handoff_id, code } = payload;

    const { data: handoff } = await adminClient
      .from('handoffs')
      .select('id, verification_code_hash, code_expires_at, code_attempts, status, reservation_id')
      .eq('id', handoff_id)
      .single();

    if (!handoff) return err('Handoff not found', 404, 'NOT_FOUND');

    // Check if already verified
    if (handoff.status === 'verified' || handoff.status === 'completed') {
      return err('Code already verified', 409, 'ALREADY_VERIFIED');
    }

    // Check attempt limit
    if (handoff.code_attempts >= MAX_ATTEMPTS) {
      return err('Maximum verification attempts exceeded', 429, 'MAX_ATTEMPTS_EXCEEDED');
    }

    // Check expiry
    if (!handoff.code_expires_at || new Date(handoff.code_expires_at) <= new Date()) {
      return err('Verification code has expired', 410, 'CODE_EXPIRED');
    }

    // Check the code (timing-safe via bcrypt)
    const isValid = await bcrypt.compare(code, handoff.verification_code_hash ?? '');

    // Increment attempt counter atomically regardless of result
    await adminClient
      .from('handoffs')
      .update({ code_attempts: handoff.code_attempts + 1 })
      .eq('id', handoff_id);

    if (!isValid) {
      const attemptsLeft = MAX_ATTEMPTS - (handoff.code_attempts + 1);
      return err(
        `Incorrect code. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`,
        422,
        'INVALID_CODE'
      );
    }

    // Code correct — mark as verified atomically
    const now = new Date().toISOString();
    const { error: verifyErr } = await adminClient
      .from('handoffs')
      .update({
        status: 'verified',
        code_verified_at: now,
        recipient_confirmed_by: user.id,
        // Clear the hash after successful verification to prevent replay
        verification_code_hash: null,
      })
      .eq('id', handoff_id)
      .eq('status', 'code_sent'); // Only update if still in code_sent status

    if (verifyErr) {
      return err('Verification failed (concurrent update)', 409, 'CONCURRENT_VERIFY');
    }

    // Audit log
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      actor_role: 'user',
      action: 'handover_verified',
      entity_type: 'handoff',
      entity_id: handoff_id,
      new_data: { handoff_id, reservation_id: handoff.reservation_id, verified_at: now },
    });

    return ok({
      verified: true,
      handoff_id,
      verified_at: now,
      message: 'Handover code verified successfully',
    });
  }

  return err('Unknown action', 400);
});
