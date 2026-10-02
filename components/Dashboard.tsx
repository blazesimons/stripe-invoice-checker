'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  STATUS_LABEL,
  STATUS_ORDER,
  enrichAll,
  filterRows,
  formatDate,
  formatDateTime,
  formatMoney,
  sortRows,
  summarize,
  type InvoiceRow,
  type OverdueFilter,
  type RawInvoice,
  type SortKey,
  type StatusFilter,
} from '@/lib/invoices';
import { makeSampleInvoices } from '@/lib/sample';
import { KEY_STORAGE } from '@/components/storage';

export interface DashboardProps {
  mode: 'demo' | 'live';
  /** Invoices fetched on the server, or null when the browser must fetch them itself. */
  initialInvoices: RawInvoice[] | null;
  /** ISO timestamp used for "days overdue" on first render (keeps SSR and hydration identical). */
  initialNow: string;
  /** True when a sealed OAuth session cookie was present on the server. */
  serverSession?: boolean;
  accountLabel?: string | null;
  initialError?: string | null;
  /** Hide the toolbar title row (used when embedded on the landing page). */
  embedded?: boolean;
}

interface ApiResponse {
  invoices?: RawInvoice[];
  error?: string;
  message?: string;
  account?: string | null;
  source?: 'restricted_key' | 'oauth';
}

const OVERDUE_OPTIONS: { value: OverdueFilter; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'overdue', label: 'Overdue (1+ days)' },
  { value: '7', label: '7+ days' },
  { value: '30', label: '30+ days' },
  { value: '60', label: '60+ days' },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'overdue', label: 'Unpaid, most overdue first' },
  { value: 'due', label: 'Due date' },
  { value: 'owed', label: 'Amount owed' },
  { value: 'amount', label: 'Invoice amount' },
  { value: 'created', label: 'Newest' },
  { value: 'customer', label: 'Customer A–Z' },
];

export default function Dashboard({
  mode,
  initialInvoices,
  initialNow,
  serverSession = false,
  accountLabel = null,
  initialError = null,
  embedded = false,
}: DashboardProps) {
  const router = useRouter();
  const initialNowMs = useMemo(() => new Date(initialNow).getTime(), [initialNow]);

  const [invoices, setInvoices] = useState<RawInvoice[] | null>(initialInvoices);
  const [nowMs, setNowMs] = useState<number>(initialNowMs);
  const [lastSynced, setLastSynced] = useState<number | null>(initialInvoices ? initialNowMs : null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(initialError);
  const [account, setAccount] = useState<string | null>(accountLabel);
  const [source, setSource] = useState<'oauth' | 'restricted_key' | null>(serverSession ? 'oauth' : null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [overdueFilter, setOverdueFilter] = useState<OverdueFilter>('any');
  const [query, setQuery] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('overdue');

  const sync = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = Date.now();
      if (mode === 'demo') {
        await new Promise((r) => setTimeout(r, 350));
        setInvoices(makeSampleInvoices(now));
      } else {
        const key = window.sessionStorage.getItem(KEY_STORAGE);
        const headers: Record<string, string> = {};
        if (key) headers['x-stripe-key'] = key;
        const res = await fetch('/api/invoices', { headers, cache: 'no-store' });
        const body = (await res.json().catch(() => ({}))) as ApiResponse;
        if (res.status === 401) {
          if (key) window.sessionStorage.removeItem(KEY_STORAGE);
          router.replace(`/connect?error=${encodeURIComponent(body.error ?? 'not_connected')}`);
          return;
        }
        if (!res.ok || !body.invoices) {
          throw new Error(body.message ?? `Stripe request failed (HTTP ${res.status}).`);
        }
        setInvoices(body.invoices);
        setSource(body.source ?? (key ? 'restricted_key' : 'oauth'));
        setAccount(body.account ?? (key ? 'Restricted key' : null));
      }
      setNowMs(now);
      setLastSynced(now);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed.');
    } finally {
      setLoading(false);
    }
  }, [mode, router]);

  // Live mode without a server session: look for a browser-held restricted key.
  useEffect(() => {
    if (mode !== 'live' || initialInvoices !== null || serverSession) return;
    const key = window.sessionStorage.getItem(KEY_STORAGE);
    if (!key) {
      router.replace('/connect');
      return;
    }
    void sync();
  }, [mode, initialInvoices, serverSession, router, sync]);

  async function disconnect() {
    window.sessionStorage.removeItem(KEY_STORAGE);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore: cookie clearing is best-effort, we navigate away regardless
    }
    router.push('/connect');
  }

  const rows: InvoiceRow[] = useMemo(() => (invoices ? enrichAll(invoices, nowMs) : []), [invoices, nowMs]);
  const summary = useMemo(() => summarize(rows), [rows]);
  const visible = useMemo(
    () => sortRows(filterRows(rows, { status: statusFilter, overdue: overdueFilter, query }), sortKey),
    [rows, statusFilter, overdueFilter, query, sortKey],
  );

  const owedEntries = Object.entries(summary.owedByCurrency).sort((a, b) => b[1] - a[1]);
  const filtersActive = statusFilter !== 'all' || overdueFilter !== 'any' || query.trim() !== '';

  return (
    <section className={`dashboard${embedded ? ' dashboard--embedded' : ''}`} aria-label="Invoice dashboard">
      {!embedded ? (
        <div className="dashboard__title">
          <div>
            <h1>Invoices</h1>
            <p className="muted">
              {mode === 'demo' ? (
                <>
                  Sample data · <Link href="/connect">Connect your Stripe account</Link> to see real invoices.
                </>
              ) : (
                <>
                  {source === 'restricted_key' ? 'Read-only restricted key' : 'Connected via Stripe'}
                  {account && source !== 'restricted_key' ? <> · {account}</> : null}
                </>
              )}
            </p>
          </div>
          {mode === 'live' ? (
            <button type="button" className="btn btn--ghost btn--small" onClick={disconnect}>
              Disconnect
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="stats" role="list">
        <div className="stat" role="listitem">
          <span className="stat__label">Outstanding</span>
          <span className="stat__value">
            {owedEntries.length === 0 ? formatMoney(0, 'usd') : formatMoney(owedEntries[0][1], owedEntries[0][0])}
          </span>
          {owedEntries.length > 1 ? (
            <span className="stat__sub">
              + {owedEntries.length - 1} other {owedEntries.length - 1 === 1 ? 'currency' : 'currencies'}
            </span>
          ) : (
            <span className="stat__sub">across open invoices</span>
          )}
        </div>
        <div className="stat stat--warn" role="listitem">
          <span className="stat__label">Overdue</span>
          <span className="stat__value">{summary.countOverdue}</span>
          <span className="stat__sub">open invoices past due</span>
        </div>
        <div className="stat" role="listitem">
          <span className="stat__label">Unpaid</span>
          <span className="stat__value">{summary.countUnpaid + summary.countPartial}</span>
          <span className="stat__sub">{summary.countPartial} partially paid</span>
        </div>
        <div className="stat stat--ok" role="listitem">
          <span className="stat__label">Paid</span>
          <span className="stat__value">{summary.countPaid}</span>
          <span className="stat__sub">{summary.countExpired} expired</span>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar__group" role="group" aria-label="Filter by status">
          <button
            type="button"
            className={`chip${statusFilter === 'all' ? ' chip--active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All <span className="chip__count">{rows.length}</span>
          </button>
          {STATUS_ORDER.map((s) => {
            const count =
              s === 'unpaid'
                ? summary.countUnpaid
                : s === 'partial'
                  ? summary.countPartial
                  : s === 'paid'
                    ? summary.countPaid
                    : summary.countExpired;
            return (
              <button
                key={s}
                type="button"
                className={`chip chip--${s}${statusFilter === s ? ' chip--active' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {STATUS_LABEL[s]} <span className="chip__count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="toolbar__group toolbar__group--controls">
          <label className="control">
            <span>Days overdue</span>
            <select value={overdueFilter} onChange={(e) => setOverdueFilter(e.target.value as OverdueFilter)}>
              {OVERDUE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="control">
            <span>Sort</span>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="control control--grow">
            <span>Customer</span>
            <input
              type="search"
              placeholder="Search name, email, invoice #"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button type="button" className="btn" onClick={() => void sync()} disabled={loading}>
            {loading ? 'Syncing…' : 'Sync from Stripe'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="alert alert--error" role="alert">
          <strong>Couldn&apos;t load invoices.</strong> {error}{' '}
          <button type="button" className="link-button" onClick={() => void sync()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="table-wrap">
        <table className="invoices">
          <thead>
            <tr>
              <th scope="col">Invoice #</th>
              <th scope="col">Customer</th>
              <th scope="col" className="num">
                Amount
              </th>
              <th scope="col">Status</th>
              <th scope="col">Created</th>
              <th scope="col">Due</th>
              <th scope="col" className="num">
                Days overdue
              </th>
              <th scope="col">Last event</th>
            </tr>
          </thead>
          <tbody>
            {invoices === null && !error ? (
              <tr>
                <td colSpan={8} className="empty">
                  Loading invoices from Stripe…
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty">
                  {rows.length === 0
                    ? 'No finalized invoices found on this account.'
                    : 'No invoices match these filters.'}
                  {filtersActive ? (
                    <>
                      {' '}
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => {
                          setStatusFilter('all');
                          setOverdueFilter('any');
                          setQuery('');
                        }}
                      >
                        Clear filters
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ) : (
              visible.map((r) => (
                <tr key={r.id} className={r.daysOverdue > 0 && r.owed > 0 ? 'row--overdue' : undefined}>
                  <td className="mono">
                    {r.hosted_invoice_url ? (
                      <a href={r.hosted_invoice_url} target="_blank" rel="noreferrer noopener">
                        {r.number ?? r.id}
                      </a>
                    ) : (
                      r.number ?? r.id
                    )}
                  </td>
                  <td>
                    <div className="customer">
                      <span>{r.customerLabel}</span>
                      {r.customer_email && r.customer_email !== r.customerLabel ? (
                        <span className="muted small">{r.customer_email}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="num">
                    <div className="amount">
                      <span>{formatMoney(r.amount_due, r.currency)}</span>
                      {r.displayStatus === 'partial' ? (
                        <span className="muted small">
                          {formatMoney(r.owed, r.currency)} owed · {formatMoney(r.amount_paid, r.currency)} paid
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge--${r.displayStatus}`}>{STATUS_LABEL[r.displayStatus]}</span>
                  </td>
                  <td className="nowrap">{formatDate(r.created)}</td>
                  <td className="nowrap">{formatDate(r.due_date)}</td>
                  <td className="num">
                    {r.daysOverdue > 0 ? (
                      <span className={r.owed > 0 ? 'overdue-days' : 'muted'}>{r.daysOverdue}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="nowrap">
                    <span>{r.lastEvent.label}</span> <span className="muted small">{formatDate(r.lastEvent.at)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="table-footer muted small">
        Showing {visible.length} of {rows.length} invoices
        {lastSynced ? <> · last synced {formatDateTime(lastSynced)}</> : null}
        {' · '}
        drafts are hidden · read-only, nothing is stored.
      </p>
    </section>
  );
}
