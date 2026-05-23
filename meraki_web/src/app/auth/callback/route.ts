import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Handles Supabase Auth confirmation links (email change, signup confirm, recovery, etc.).
 *
 * Supabase emits two URL shapes depending on flow:
 *   1. PKCE — `?code=<code>` → exchange via supabase.auth.exchangeCodeForSession(code)
 *   2. OTP  — `?token_hash=<hash>&type=<type>` → verify via supabase.auth.verifyOtp({ type, token_hash })
 *
 * For email change, BOTH the old and new email confirmation links must be clicked
 * for the change to complete. Each link hits this handler and exchanges its code/hash.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const typeParam = searchParams.get('type');
  const next = searchParams.get('next') ?? '/dashboard';

  // Build a safe `next` URL — only allow same-origin paths
  const safeNext = next.startsWith('/') ? next : '/dashboard';
  const redirectTo = new URL(safeNext, origin);

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const errUrl = new URL('/login', origin);
      errUrl.searchParams.set('error', 'auth_callback_failed');
      errUrl.searchParams.set('message', error.message);
      return NextResponse.redirect(errUrl);
    }
    return NextResponse.redirect(redirectTo);
  }

  if (tokenHash && typeParam) {
    const allowedTypes = [
      'signup',
      'magiclink',
      'recovery',
      'invite',
      'email',
      'email_change',
    ] as const;
    type EmailOtpType = (typeof allowedTypes)[number];
    const t = typeParam as EmailOtpType;
    if (!allowedTypes.includes(t)) {
      const errUrl = new URL('/login', origin);
      errUrl.searchParams.set('error', 'invalid_otp_type');
      return NextResponse.redirect(errUrl);
    }

    const { error } = await supabase.auth.verifyOtp({ type: t, token_hash: tokenHash });
    if (error) {
      const errUrl = new URL('/login', origin);
      errUrl.searchParams.set('error', 'auth_callback_failed');
      errUrl.searchParams.set('message', error.message);
      return NextResponse.redirect(errUrl);
    }
    return NextResponse.redirect(redirectTo);
  }

  // Neither param present — just bounce back to login with a hint
  const fallback = new URL('/login', origin);
  fallback.searchParams.set('error', 'missing_auth_params');
  return NextResponse.redirect(fallback);
}
