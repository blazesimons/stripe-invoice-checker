'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { KEY_STORAGE } from '@/components/storage';

const KEY_PATTERN = /^rk_(live|test)_[A-Za-z0-9]+$/;

/**
 * Alternative to OAuth: the merchant pastes a *restricted* API key scoped to
 * "Invoices: Read". It lives only in this tab's sessionStorage and is sent to our
 * API route per request; we never store it.
 */
export default function ConnectForm() {
  const router = useRouter();
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = key.trim();
    if (trimmed.startsWith('sk_')) {
      setError('That is a full secret key. Create a restricted key with only "Invoices: Read" instead.');
      return;
    }
    if (!KEY_PATTERN.test(trimmed)) {
      setError('Restricted keys start with rk_live_ or rk_test_.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/invoices', { headers: { 'x-stripe-key': trimmed }, cache: 'no-store' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? `Stripe rejected the key (HTTP ${res.status}).`);
        setBusy(false);
        return;
      }
      window.sessionStorage.setItem(KEY_STORAGE, trimmed);
      router.push('/dashboard');
    } catch {
      setError('Could not reach the server. Try again.');
      setBusy(false);
    }
  }

  return (
    <form className="connect-form" onSubmit={onSubmit}>
      <label htmlFor="rk" className="label">
        Restricted API key
      </label>
      <div className="connect-form__row">
        <input
          id="rk"
          name="rk"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="rk_live_…"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="input"
          required
        />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Checking…' : 'View invoices'}
        </button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="hint">
        In Stripe: <strong>Developers → API keys → Create restricted key</strong>, grant only{' '}
        <strong>Invoices: Read</strong>. The key stays in this browser tab and is cleared when you close it.
      </p>
    </form>
  );
}
