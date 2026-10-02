import type { Metadata } from 'next';
import Link from 'next/link';
import ConnectForm from '@/components/ConnectForm';
import { oauthConfigured } from '@/lib/config';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Connect your Stripe account — Stripe Invoice Status Checker',
};

const ERROR_TEXT: Record<string, string> = {
  access_denied: 'You cancelled the Stripe authorization. No changes were made.',
  state_mismatch: 'The sign-in link expired or was tampered with. Please try again.',
  not_configured: 'Stripe Connect is not configured on this deployment yet. Use a restricted key below.',
  not_connected: 'Your session ended. Connect again to continue.',
  stripe_unauthorized: 'Stripe rejected the saved credentials. Connect again to continue.',
  token_exchange_failed: 'Stripe did not return an access token. Please try again.',
};

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rawError = typeof params.error === 'string' ? params.error : null;
  const errorText = rawError ? ERROR_TEXT[rawError] ?? `Stripe reported: ${rawError}` : null;
  const oauthReady = oauthConfigured();

  return (
    <div className="container page">
      <div className="page--narrow">
        <h1>Connect your Stripe account</h1>
        <p className="muted">
          Read-only access. We fetch your invoices on demand and store nothing. Disconnect anytime from the dashboard.
        </p>

        {errorText ? (
          <div className="alert alert--error" role="alert">
            {errorText}
          </div>
        ) : null}

        <div className="card">
          {oauthReady ? (
            <>
              <h2>Sign in with Stripe</h2>
              <p className="muted">
                You&apos;ll be sent to Stripe to approve <strong>read-only</strong> access for this account, then
                straight back to your dashboard.
              </p>
              <a className="btn btn--large btn--stripe" href="/api/auth/stripe">
                Connect with Stripe
              </a>
            </>
          ) : (
            <>
              <h2>Sign in with Stripe</h2>
              <div className="alert alert--info">
                Stripe Connect is not enabled on this deployment yet (missing <code>STRIPE_CLIENT_ID</code> /{' '}
                <code>STRIPE_SECRET_KEY</code>). You can still connect with a restricted key below.
              </div>
            </>
          )}

          <div className="divider">or use a restricted API key</div>
          <ConnectForm />
        </div>

        <p className="hint" style={{ marginTop: 18 }}>
          Just looking? <Link href="/demo">Open the demo dashboard</Link> with sample invoices.
        </p>
      </div>
    </div>
  );
}
