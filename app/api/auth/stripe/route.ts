import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { baseUrl } from '@/lib/http';
import { OAUTH_STATE_COOKIE, cookieOptions, sessionsAvailable } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Step 1 of Stripe Connect OAuth: send the merchant to Stripe with a read-only scope.
 * The CSRF `state` is stored in a short-lived httpOnly cookie and checked on callback.
 */
export async function GET(req: NextRequest) {
  const origin = baseUrl(req);
  const clientId = process.env.STRIPE_CLIENT_ID;
  if (!clientId || !sessionsAvailable()) {
    return NextResponse.redirect(`${origin}/connect?error=not_configured`);
  }

  const state = randomBytes(16).toString('hex');
  const authorize = new URL('https://connect.stripe.com/oauth/authorize');
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('scope', 'read_only');
  authorize.searchParams.set('redirect_uri', `${origin}/api/auth/callback`);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('stripe_landing', 'login');

  const res = NextResponse.redirect(authorize);
  res.cookies.set(OAUTH_STATE_COOKIE, state, cookieOptions(10 * 60));
  return res;
}
