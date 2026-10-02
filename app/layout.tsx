import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import SiteHeader from '@/components/SiteHeader';
import { APP_NAME, PRICE_LABEL, TAGLINE } from '@/lib/config';
import './globals.css';

export const metadata: Metadata = {
  title: `${APP_NAME} — ${TAGLINE}`,
  description: `Connect Stripe, view invoice status, never miss an overdue invoice. ${PRICE_LABEL}.`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main>{children}</main>
        <footer className="site-footer">
          <div className="container">
            <p className="muted small">
              {APP_NAME} is an independent tool and is not affiliated with Stripe, Inc. Access is read-only; invoice data
              is never stored on our servers.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
