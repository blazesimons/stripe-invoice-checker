import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, openSession } from '@/lib/session';
import { StripeApiError, fetchAllInvoices } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

const KEY_HEADER = 'x-stripe-key';

/**
 * Returns every non-draft invoice for the connected account. Credentials come from either
 *   - the sealed OAuth session cookie (Connect flow), or
 *   - an `x-stripe-key` header holding a *restricted* key (rk_...) that the browser keeps
 *     in sessionStorage. Full secret keys are rejected so the app stays read-only.
 * Nothing is stored or logged server-side.
 */
export async function GET(req: NextRequest) {
  const headerKey = req.headers.get(KEY_HEADER)?.trim() ?? '';
  const session = openSession(req.cookies.get(SESSION_COOKIE)?.value);

  if (headerKey && !/^rk_(live|test)_[A-Za-z0-9]+$/.test(headerKey)) {
    return NextResponse.json(
      {
        error: 'invalid_key',
        message: 'Only restricted keys (rk_live_… / rk_test_…) with Invoices: Read are accepted.',
      },
      { status: 400 },
    );
  }

  const token = headerKey || session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: 'not_connected', message: 'Connect a Stripe account first.' }, { status: 401 });
  }

  try {
    const invoices = await fetchAllInvoices(token);
    return NextResponse.json(
      {
        invoices,
        fetchedAt: Date.now(),
        source: headerKey ? 'restricted_key' : 'oauth',
        account: headerKey ? null : session?.accountId ?? null,
        livemode: headerKey ? headerKey.startsWith('rk_live_') : session?.livemode ?? null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    if (e instanceof StripeApiError) {
      if (e.status === 401) {
        return NextResponse.json(
          { error: 'stripe_unauthorized', message: 'Stripe rejected the credentials. Reconnect and try again.' },
          { status: 401 },
        );
      }
      if (e.status === 403) {
        return NextResponse.json(
          { error: 'stripe_forbidden', message: `Stripe denied access: ${e.message}` },
          { status: 403 },
        );
      }
      return NextResponse.json({ error: 'stripe_error', message: e.message }, { status: 502 });
    }
    return NextResponse.json({ error: 'unknown', message: 'Could not reach Stripe.' }, { status: 502 });
  }
}
