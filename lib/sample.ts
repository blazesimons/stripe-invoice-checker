import { DAY_MS, type RawInvoice, type StripeInvoiceStatus } from '@/lib/invoices';

interface Spec {
  num: string;
  customer: string;
  email: string;
  amount: number; // minor units
  paid: number; // minor units
  status: StripeInvoiceStatus;
  createdDaysAgo: number;
  dueDaysAfterCreated: number | null;
  paidDaysAfterCreated?: number;
  currency?: string;
}

/**
 * Fifteen realistic invoices covering every status the dashboard shows:
 * 5 unpaid (3 overdue, 2 not yet due), 2 partially paid, 4 paid, 3 expired.
 * Dates are relative to `nowMs` so "days overdue" always looks current.
 */
const SPECS: Spec[] = [
  { num: 'DEMO-1041', customer: 'Blue Fern Bistro', email: 'ap@bluefernbistro.com', amount: 125000, paid: 0, status: 'open', createdDaysAgo: 52, dueDaysAfterCreated: 14 },
  { num: 'DEMO-1038', customer: 'Harbor & Vine Catering', email: 'billing@harborvine.co', amount: 348000, paid: 100000, status: 'open', createdDaysAgo: 45, dueDaysAfterCreated: 15 },
  { num: 'DEMO-1052', customer: 'Northwind Dental Group', email: 'office@northwinddental.com', amount: 89000, paid: 0, status: 'open', createdDaysAgo: 24, dueDaysAfterCreated: 10 },
  { num: 'DEMO-1055', customer: 'Pixel Loom Studio', email: 'hello@pixelloom.studio', amount: 220000, paid: 0, status: 'open', createdDaysAgo: 20, dueDaysAfterCreated: 14 },
  { num: 'DEMO-1058', customer: 'Riverbend Yoga', email: 'owner@riverbendyoga.com', amount: 32000, paid: 16000, status: 'open', createdDaysAgo: 16, dueDaysAfterCreated: 7 },
  { num: 'DEMO-1060', customer: 'Cedar Street Coffee', email: 'cedarstreetcoffee@gmail.com', amount: 64000, paid: 0, status: 'open', createdDaysAgo: 9, dueDaysAfterCreated: 7 },
  { num: 'DEMO-1063', customer: 'Lumen Analytics Inc.', email: 'finance@lumenanalytics.io', amount: 490000, paid: 0, status: 'open', createdDaysAgo: 5, dueDaysAfterCreated: 30 },
  { num: 'DEMO-1064', customer: 'Maple & Co. Accounting', email: 'accounts@mapleco.com', amount: 117500, paid: 0, status: 'open', createdDaysAgo: 2, dueDaysAfterCreated: 14 },
  { num: 'DEMO-1061', customer: 'Brightwave Media', email: 'ap@brightwave.media', amount: 150000, paid: 150000, status: 'paid', createdDaysAgo: 7, dueDaysAfterCreated: 7, paidDaysAfterCreated: 1 },
  { num: 'DEMO-1050', customer: 'Oakline Architects', email: 'payables@oakline.archi', amount: 750000, paid: 750000, status: 'paid', createdDaysAgo: 28, dueDaysAfterCreated: 14, paidDaysAfterCreated: 10 },
  { num: 'DEMO-1047', customer: 'Saffron Table', email: 'manager@saffrontable.com', amount: 98000, paid: 98000, status: 'paid', createdDaysAgo: 33, dueDaysAfterCreated: 14, paidDaysAfterCreated: 12 },
  { num: 'DEMO-1044', customer: 'Greenfield Landscaping', email: 'greenfieldlandscaping@outlook.com', amount: 215000, paid: 215000, status: 'paid', createdDaysAgo: 40, dueDaysAfterCreated: 30, paidDaysAfterCreated: 33 },
  { num: 'DEMO-1029', customer: 'Tidewater Print Shop', email: 'orders@tidewaterprint.com', amount: 41000, paid: 0, status: 'void', createdDaysAgo: 70, dueDaysAfterCreated: 14 },
  { num: 'DEMO-1019', customer: 'Summit Peak Fitness', email: 'billing@summitpeakfit.com', amount: 199000, paid: 50000, status: 'uncollectible', createdDaysAgo: 95, dueDaysAfterCreated: 15 },
  { num: 'DEMO-1012', customer: 'Dockside Fish Market', email: 'dockside.fish@gmail.com', amount: 276000, paid: 0, status: 'uncollectible', createdDaysAgo: 120, dueDaysAfterCreated: 14 },
];

export function makeSampleInvoices(nowMs: number): RawInvoice[] {
  // Anchor to the start of the current UTC day so SSR and client agree exactly.
  const dayStart = Math.floor(nowMs / DAY_MS) * DAY_MS;
  return SPECS.map((s, i) => {
    const createdMs = dayStart - s.createdDaysAgo * DAY_MS + 9 * 3_600_000; // 09:00 UTC
    const created = Math.floor(createdMs / 1000);
    const due = s.dueDaysAfterCreated == null ? null : created + s.dueDaysAfterCreated * 86_400;
    const paidAt = s.status === 'paid' ? created + (s.paidDaysAfterCreated ?? 0) * 86_400 : null;
    const uncollectibleAt = s.status === 'uncollectible' && due != null ? due + 30 * 86_400 : null;
    const voidedAt = s.status === 'void' ? created + 3 * 86_400 : null;
    return {
      id: `in_demo_${String(i + 1).padStart(4, '0')}`,
      number: s.num,
      customer: `cus_demo_${String(i + 1).padStart(4, '0')}`,
      customer_name: s.customer,
      customer_email: s.email,
      amount_due: s.amount,
      amount_paid: s.paid,
      amount_remaining: s.status === 'paid' || s.status === 'void' ? 0 : s.amount - s.paid,
      currency: s.currency ?? 'usd',
      status: s.status,
      created,
      due_date: due,
      hosted_invoice_url: null,
      status_transitions: {
        finalized_at: created,
        paid_at: paidAt,
        marked_uncollectible_at: uncollectibleAt,
        voided_at: voidedAt,
      },
    };
  });
}

export const SAMPLE_COUNT = SPECS.length;
