/**
 * Pure invoice logic shared by the server (API routes, SSR) and the client
 * (dashboard filters/sorting). No Node-only imports here.
 */

export type StripeInvoiceStatus = 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';

export interface StatusTransitions {
  finalized_at: number | null;
  paid_at: number | null;
  marked_uncollectible_at: number | null;
  voided_at: number | null;
}

/** The subset of a Stripe Invoice object the app needs. Amounts are in minor units. */
export interface RawInvoice {
  id: string;
  number: string | null;
  customer: string | null;
  customer_name: string | null;
  customer_email: string | null;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  currency: string;
  status: StripeInvoiceStatus | null;
  created: number;
  due_date: number | null;
  hosted_invoice_url: string | null;
  status_transitions: StatusTransitions | null;
}

export type DisplayStatus = 'unpaid' | 'partial' | 'paid' | 'expired';

export const STATUS_ORDER: DisplayStatus[] = ['unpaid', 'partial', 'paid', 'expired'];

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partially paid',
  paid: 'Paid',
  expired: 'Expired',
};

export interface LastEvent {
  label: string;
  at: number;
}

export interface InvoiceRow extends RawInvoice {
  displayStatus: DisplayStatus;
  daysOverdue: number;
  /** Amount still owed, in minor units (0 for paid / void). */
  owed: number;
  customerLabel: string;
  lastEvent: LastEvent;
}

export type SortKey = 'overdue' | 'due' | 'owed' | 'amount' | 'created' | 'customer';
export type OverdueFilter = 'any' | 'overdue' | '7' | '30' | '60';
export type StatusFilter = 'all' | DisplayStatus;

export const DAY_MS = 86_400_000;

/**
 * Status mapping (PRD "Basic Status Logic"):
 *   Paid            -> Stripe status `paid`
 *   Partially paid  -> `open` with amount_paid > 0
 *   Unpaid          -> `open` with nothing paid yet (overdue invoices stay here and
 *                      are flagged by the "days overdue" column/filters)
 *   Expired         -> `uncollectible` or `void` (Stripe's terminal non-paid states)
 *
 * The PRD also lists "due_date < today" under Expired. We deliberately keep past-due
 * open invoices under Unpaid/Partially paid so that the "unpaid" filter and the
 * "days overdue" filter can be combined; otherwise every overdue invoice would vanish
 * from the unpaid view, which is the view merchants care about most.
 */
export function deriveStatus(inv: RawInvoice): DisplayStatus {
  if (inv.status === 'paid') return 'paid';
  if (inv.status === 'uncollectible' || inv.status === 'void') return 'expired';
  if (inv.amount_paid > 0) return 'partial';
  return 'unpaid';
}

/** Whole days past the due date for anything that is still owed; 0 otherwise. */
export function daysOverdue(inv: RawInvoice, nowMs: number): number {
  if (inv.due_date == null) return 0;
  if (inv.status === 'paid' || inv.status === 'void' || inv.status === 'draft') return 0;
  const diff = Math.floor((nowMs - inv.due_date * 1000) / DAY_MS);
  return diff > 0 ? diff : 0;
}

export function amountOwed(inv: RawInvoice): number {
  if (inv.status === 'paid' || inv.status === 'void') return 0;
  if (typeof inv.amount_remaining === 'number') return Math.max(0, inv.amount_remaining);
  return Math.max(0, inv.amount_due - inv.amount_paid);
}

export function customerLabel(inv: RawInvoice): string {
  return inv.customer_name || inv.customer_email || inv.customer || 'Unknown customer';
}

export function lastEvent(inv: RawInvoice): LastEvent {
  const candidates: LastEvent[] = [{ label: 'Created', at: inv.created }];
  const t = inv.status_transitions;
  if (t) {
    if (t.finalized_at) candidates.push({ label: 'Finalized', at: t.finalized_at });
    if (t.paid_at) candidates.push({ label: 'Paid', at: t.paid_at });
    if (t.marked_uncollectible_at) {
      candidates.push({ label: 'Marked uncollectible', at: t.marked_uncollectible_at });
    }
    if (t.voided_at) candidates.push({ label: 'Voided', at: t.voided_at });
  }
  return candidates.reduce((best, c) => (c.at >= best.at ? c : best), candidates[0]);
}

export function enrich(inv: RawInvoice, nowMs: number): InvoiceRow {
  return {
    ...inv,
    displayStatus: deriveStatus(inv),
    daysOverdue: daysOverdue(inv, nowMs),
    owed: amountOwed(inv),
    customerLabel: customerLabel(inv),
    lastEvent: lastEvent(inv),
  };
}

export function enrichAll(invoices: RawInvoice[], nowMs: number): InvoiceRow[] {
  return invoices.map((inv) => enrich(inv, nowMs));
}

export interface Filters {
  status: StatusFilter;
  overdue: OverdueFilter;
  query: string;
}

export function filterRows(rows: InvoiceRow[], f: Filters): InvoiceRow[] {
  const q = f.query.trim().toLowerCase();
  const minOverdue = f.overdue === 'any' ? 0 : f.overdue === 'overdue' ? 1 : Number(f.overdue);
  return rows.filter((r) => {
    if (f.status !== 'all' && r.displayStatus !== f.status) return false;
    if (minOverdue > 0 && r.daysOverdue < minOverdue) return false;
    if (q) {
      const hay = `${r.customerLabel} ${r.customer_email ?? ''} ${r.number ?? ''} ${r.id}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function cmpNum(a: number, b: number): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

/**
 * Default sort ("overdue"): everything still owed first, most overdue at the top,
 * then by soonest due date; paid/expired-with-nothing-owed afterwards, newest first.
 */
export function sortRows(rows: InvoiceRow[], key: SortKey): InvoiceRow[] {
  const copy = rows.slice();
  switch (key) {
    case 'overdue':
      copy.sort((a, b) => {
        const aOwed = a.owed > 0 ? 1 : 0;
        const bOwed = b.owed > 0 ? 1 : 0;
        if (aOwed !== bOwed) return bOwed - aOwed;
        if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
        const aDue = a.due_date ?? Number.MAX_SAFE_INTEGER;
        const bDue = b.due_date ?? Number.MAX_SAFE_INTEGER;
        if (aDue !== bDue) return cmpNum(aDue, bDue);
        return b.created - a.created;
      });
      break;
    case 'due':
      copy.sort((a, b) => {
        const aDue = a.due_date ?? Number.MAX_SAFE_INTEGER;
        const bDue = b.due_date ?? Number.MAX_SAFE_INTEGER;
        return cmpNum(aDue, bDue) || b.created - a.created;
      });
      break;
    case 'owed':
      copy.sort((a, b) => b.owed - a.owed || b.created - a.created);
      break;
    case 'amount':
      copy.sort((a, b) => b.amount_due - a.amount_due || b.created - a.created);
      break;
    case 'created':
      copy.sort((a, b) => b.created - a.created);
      break;
    case 'customer':
      copy.sort((a, b) => a.customerLabel.localeCompare(b.customerLabel) || b.created - a.created);
      break;
  }
  return copy;
}

export interface Summary {
  totalInvoices: number;
  countUnpaid: number;
  countPartial: number;
  countPaid: number;
  countExpired: number;
  countOverdue: number;
  /** Outstanding balance per currency (minor units), open invoices only. */
  owedByCurrency: Record<string, number>;
}

export function summarize(rows: InvoiceRow[]): Summary {
  const s: Summary = {
    totalInvoices: rows.length,
    countUnpaid: 0,
    countPartial: 0,
    countPaid: 0,
    countExpired: 0,
    countOverdue: 0,
    owedByCurrency: {},
  };
  for (const r of rows) {
    if (r.displayStatus === 'unpaid') s.countUnpaid++;
    else if (r.displayStatus === 'partial') s.countPartial++;
    else if (r.displayStatus === 'paid') s.countPaid++;
    else s.countExpired++;
    if (r.status === 'open' && r.daysOverdue > 0) s.countOverdue++;
    if (r.status === 'open' && r.owed > 0) {
      const cur = r.currency.toLowerCase();
      s.owedByCurrency[cur] = (s.owedByCurrency[cur] ?? 0) + r.owed;
    }
  }
  return s;
}

const ZERO_DECIMAL = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

export function formatMoney(minor: number, currency: string): string {
  const cur = currency.toLowerCase();
  const zero = ZERO_DECIMAL.has(cur);
  const major = zero ? minor : minor / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cur.toUpperCase(),
      minimumFractionDigits: zero ? 0 : 2,
      maximumFractionDigits: zero ? 0 : 2,
    }).format(major);
  } catch {
    return `${major.toFixed(zero ? 0 : 2)} ${cur.toUpperCase()}`;
  }
}

/** Fixed locale + UTC so server and client render identical strings (no hydration drift). */
export function formatDate(unixSeconds: number | null): string {
  if (unixSeconds == null) return '—';
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}
