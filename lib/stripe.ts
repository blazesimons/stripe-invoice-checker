import type { RawInvoice, StripeInvoiceStatus } from '@/lib/invoices';

const STRIPE_API = 'https://api.stripe.com/v1';
const PAGE_SIZE = 100;
/** Hard cap so a huge account can't make the request hang: 10 pages = 1,000 invoices. */
const MAX_PAGES = 10;

export class StripeApiError extends Error {
  status: number;
  code: string | undefined;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'StripeApiError';
    this.status = status;
    this.code = code;
  }
}

type Json = Record<string, unknown>;

function isRecord(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

const STATUSES: ReadonlySet<string> = new Set(['draft', 'open', 'paid', 'uncollectible', 'void']);

function status(v: unknown): StripeInvoiceStatus | null {
  return typeof v === 'string' && STATUSES.has(v) ? (v as StripeInvoiceStatus) : null;
}

/** Keep only the fields the dashboard uses; the full Stripe invoice object is large. */
export function pickInvoice(raw: Json): RawInvoice {
  const customer = raw.customer;
  const customerId = typeof customer === 'string' ? customer : isRecord(customer) ? str(customer.id) : null;
  const customerObj = isRecord(customer) ? customer : null;
  const t = isRecord(raw.status_transitions) ? raw.status_transitions : null;
  return {
    id: str(raw.id) ?? '',
    number: str(raw.number),
    customer: customerId,
    customer_name: str(raw.customer_name) ?? (customerObj ? str(customerObj.name) : null),
    customer_email: str(raw.customer_email) ?? (customerObj ? str(customerObj.email) : null),
    amount_due: num(raw.amount_due),
    amount_paid: num(raw.amount_paid),
    amount_remaining: num(raw.amount_remaining),
    currency: str(raw.currency) ?? 'usd',
    status: status(raw.status),
    created: num(raw.created),
    due_date: numOrNull(raw.due_date),
    hosted_invoice_url: str(raw.hosted_invoice_url),
    status_transitions: t
      ? {
          finalized_at: numOrNull(t.finalized_at),
          paid_at: numOrNull(t.paid_at),
          marked_uncollectible_at: numOrNull(t.marked_uncollectible_at),
          voided_at: numOrNull(t.voided_at),
        }
      : null,
  };
}

async function stripeGet(path: string, token: string, params: URLSearchParams): Promise<Json> {
  const res = await fetch(`${STRIPE_API}${path}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = isRecord(body) && isRecord(body.error) ? body.error : null;
    const message = (err && str(err.message)) || `Stripe returned HTTP ${res.status}`;
    const code = err ? str(err.code) ?? str(err.type) ?? undefined : undefined;
    throw new StripeApiError(res.status, message, code);
  }
  if (!isRecord(body)) throw new StripeApiError(502, 'Unexpected response from Stripe');
  return body;
}

/**
 * Fetch every non-draft invoice on the account, newest first (Stripe's default order).
 * Works with a Connect OAuth access token or a restricted key (Invoices: Read).
 */
export async function fetchAllInvoices(token: string): Promise<RawInvoice[]> {
  const out: RawInvoice[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (startingAfter) params.set('starting_after', startingAfter);
    const body = await stripeGet('/invoices', token, params);
    const data = Array.isArray(body.data) ? body.data : [];
    for (const item of data) {
      if (!isRecord(item)) continue;
      const inv = pickInvoice(item);
      if (inv.status === 'draft' || !inv.id) continue;
      out.push(inv);
    }
    const last = data[data.length - 1];
    if (body.has_more !== true || !isRecord(last) || typeof last.id !== 'string') break;
    startingAfter = last.id;
  }
  return out;
}

export interface OAuthTokenResponse {
  access_token: string;
  stripe_user_id: string;
  livemode: boolean;
  scope: string;
}

/** Exchange a Stripe Connect authorization code for an access token. */
export async function exchangeOAuthCode(code: string, clientSecret: string): Promise<OAuthTokenResponse> {
  const form = new URLSearchParams({
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
  });
  const res = await fetch('https://connect.stripe.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    cache: 'no-store',
  });
  const raw: unknown = await res.json().catch(() => null);
  const body: Json = isRecord(raw) ? raw : {};
  const accessToken = str(body.access_token);
  if (!res.ok || accessToken === null) {
    const desc = str(body.error_description) ?? str(body.error);
    throw new StripeApiError(res.status, desc ?? 'Stripe did not return an access token');
  }
  return {
    access_token: accessToken,
    stripe_user_id: str(body.stripe_user_id) ?? '',
    livemode: body.livemode === true,
    scope: str(body.scope) ?? '',
  };
}
