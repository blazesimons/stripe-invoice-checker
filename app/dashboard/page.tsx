import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Dashboard from '@/components/Dashboard';
import type { RawInvoice } from '@/lib/invoices';
import { SESSION_COOKIE, openSession } from '@/lib/session';
import { StripeApiError, fetchAllInvoices } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard — Stripe Invoice Status Checker',
};

/**
 * With an OAuth session cookie the first page of data is fetched on the server for a
 * fast first paint. Without one, the client checks for a browser-held restricted key
 * (or redirects to /connect).
 */
export default async function DashboardPage() {
  const store = await cookies();
  const session = openSession(store.get(SESSION_COOKIE)?.value);

  let initialInvoices: RawInvoice[] | null = null;
  let initialError: string | null = null;
  if (session) {
    try {
      initialInvoices = await fetchAllInvoices(session.accessToken);
    } catch (e) {
      initialError =
        e instanceof StripeApiError ? e.message : 'Could not reach Stripe. Use "Sync from Stripe" to retry.';
    }
  }

  return (
    <div className="container page">
      <Dashboard
        mode="live"
        initialInvoices={initialInvoices}
        initialNow={new Date().toISOString()}
        serverSession={Boolean(session)}
        accountLabel={session?.accountId ?? null}
        initialError={initialError}
      />
    </div>
  );
}
