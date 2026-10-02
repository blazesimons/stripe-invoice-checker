import type { Metadata } from 'next';
import Dashboard from '@/components/Dashboard';
import { makeSampleInvoices } from '@/lib/sample';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Live demo — Stripe Invoice Status Checker',
};

export default function DemoPage() {
  const now = new Date();
  return (
    <div className="container page">
      <Dashboard mode="demo" initialInvoices={makeSampleInvoices(now.getTime())} initialNow={now.toISOString()} />
    </div>
  );
}
