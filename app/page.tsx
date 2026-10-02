import Link from 'next/link';
import Dashboard from '@/components/Dashboard';
import { PAYMENT_LINK, PRICE_LABEL, TAGLINE, hasPaymentLink } from '@/lib/config';
import { SAMPLE_COUNT, makeSampleInvoices } from '@/lib/sample';

// Rendered per request so the sample "days overdue" numbers are always current.
export const dynamic = 'force-dynamic';

export default function LandingPage() {
  const now = new Date();
  const sample = makeSampleInvoices(now.getTime());
  const paymentReady = hasPaymentLink();

  return (
    <>
      <section className="hero container">
        <span className="eyebrow">For Stripe merchants who invoice customers</span>
        <h1>{TAGLINE}</h1>
        <p className="hero__sub">
          Connect Stripe, view status, never miss an overdue invoice. Every invoice with status, days overdue and amount
          owed in one sortable table. {PRICE_LABEL}.
        </p>
        <div className="hero__cta">
          {paymentReady ? (
            <a className="btn btn--large btn--stripe" href={PAYMENT_LINK} rel="noopener">
              Subscribe · {PRICE_LABEL}
            </a>
          ) : (
            <Link className="btn btn--large btn--stripe" href="/connect">
              Connect Stripe · {PRICE_LABEL}
            </Link>
          )}
          <Link className="btn btn--large btn--ghost" href="/demo">
            Try the live demo
          </Link>
        </div>
        <p className="hero__note">
          Read-only access. We never see card numbers and can&apos;t move money. Cancel anytime.
        </p>
      </section>

      <section className="preview container" aria-labelledby="preview-heading">
        <div className="preview__head">
          <h2 id="preview-heading">What you&apos;ll see</h2>
          <span className="muted small">Sample data · {SAMPLE_COUNT} invoices · updates live on your own account</span>
        </div>
        <Dashboard mode="demo" initialInvoices={sample} initialNow={now.toISOString()} embedded />
      </section>

      <section className="section container" id="how">
        <h2>How it works</h2>
        <div className="features">
          <div className="feature">
            <span className="feature__step">1</span>
            <h3>Connect Stripe</h3>
            <p className="muted">
              One click via Stripe Connect with the read-only scope, or paste a restricted key limited to
              &ldquo;Invoices: Read&rdquo;. No payment or refund access.
            </p>
          </div>
          <div className="feature">
            <span className="feature__step">2</span>
            <h3>See every invoice at a glance</h3>
            <p className="muted">
              Unpaid, partially paid, paid and expired, sorted with the most overdue at the top. Days overdue and amount
              owed on every row.
            </p>
          </div>
          <div className="feature">
            <span className="feature__step">3</span>
            <h3>Filter and follow up</h3>
            <p className="muted">
              Filter by status or days overdue, search by customer, open the hosted invoice, and hit &ldquo;Sync from
              Stripe&rdquo; whenever you want fresh numbers.
            </p>
          </div>
        </div>
      </section>

      <section className="section container" id="pricing">
        <h2>Simple pricing</h2>
        <div className="pricing">
          <div className="price-card">
            <div className="price-card__amount">
              $19 <span>/ month</span>
            </div>
            <p className="muted">Less than one late invoice&apos;s worth of chasing.</p>
            <ul>
              <li>Unlimited invoices and customers</li>
              <li>Status, aging and amount-owed at a glance</li>
              <li>Filters by status and days overdue</li>
              <li>On-demand sync from Stripe</li>
              <li>Read-only, nothing stored, cancel anytime</li>
            </ul>
            {paymentReady ? (
              <a className="btn btn--large btn--stripe" href={PAYMENT_LINK} rel="noopener">
                Subscribe with Stripe
              </a>
            ) : (
              <Link className="btn btn--large btn--stripe" href="/connect">
                Get started
              </Link>
            )}
            {!paymentReady ? (
              <p className="hint">Checkout opens soon. Connect your account now and we&apos;ll email you when billing starts.</p>
            ) : (
              <p className="hint">Secure checkout by Stripe. You&apos;ll be back here in under a minute.</p>
            )}
          </div>
        </div>
      </section>

      <section className="section container" id="faq">
        <h2>Questions</h2>
        <div className="faq">
          <details>
            <summary>Is this safe? What can the app access?</summary>
            <p>
              The Stripe Connect flow requests the <code>read_only</code> scope, and the alternative restricted key only
              needs &ldquo;Invoices: Read&rdquo;. The app cannot create charges, issue refunds or change anything in your
              account.
            </p>
          </details>
          <details>
            <summary>Where is my data stored?</summary>
            <p>
              Nowhere. Invoices are fetched from Stripe on demand and rendered in your browser. Your access token lives in
              an encrypted, httpOnly session cookie that expires after 8 hours.
            </p>
          </details>
          <details>
            <summary>How are statuses decided?</summary>
            <p>
              Paid = Stripe status <em>paid</em>. Partially paid = <em>open</em> with a payment already applied. Unpaid =
              <em>open</em> with nothing paid, flagged with days overdue once past the due date. Expired = Stripe marked
              it <em>uncollectible</em> or <em>void</em>. Drafts are hidden.
            </p>
          </details>
          <details>
            <summary>Can I export to CSV or send reminders?</summary>
            <p>Not yet. CSV export and email reminders are next on the roadmap for subscribers.</p>
          </details>
        </div>
      </section>
    </>
  );
}
