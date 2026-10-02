import { NextResponse, type NextRequest } from 'next/server';
import { baseUrl } from '@/lib/http';
import { OAUTH_STATE_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, cookieOptions, sealSession } from '@/lib/session';
import { StripeApiError, exchangeOAuthCode } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * Step 2 of Stripe Connect OAuth: verify `state`, exchange the code for an access token,
 * and seal it into the session cookie. The token never leaves the server.
 */
export async function GET(req: NextRequest) {
  const origin = baseUrl(req);
  const params = req.nextUrl.searchParams;
  const fail = (code: string) => {
    const res = NextResponse.redirect(`${origin}/connect?error=${encodeURIComponent(code)}`);
    res.cookies.set(OAUTH_STATE_COOKIE, '', cookieOptions(0));
    return res;
  };

  const oauthError = params.get('error');
  if (oauthError) return fail(oauthError);

  const code = params.get('code');
  const state = params.get('state');
  const expected = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected) return fail('state_mismatch');

  const clientSecret = process.env.STRIPE_SECRET_KEY;
  if (!clientSecret) return fail('not_configured');

  try {
    const token = await exchangeOAuthCode(code, clientSecret);
    const sealed = sealSession({
      accessToken: token.access_token,
      accountId: token.stripe_user_id,
      livemode: token.livemode,
      connectedAt: Date.now(),
    });
    if (!sealed) return fail('not_configured');
    const res = NextResponse.redirect(`${origin}/dashboard`);
    res.cookies.set(OAUTH_STATE_COOKIE, '', cookieOptions(0));
    res.cookies.set(SESSION_COOKIE, sealed, cookieOptions(SESSION_MAX_AGE_SECONDS));
    return res;
  } catch (e) {
    const msg = e instanceof StripeApiError ? e.message : 'token_exchange_failed';
    return fail(msg);
  }
}
