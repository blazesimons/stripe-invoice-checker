import Link from 'next/link';
import { SHORT_NAME } from '@/lib/config';

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="brand" aria-label={`${SHORT_NAME} home`}>
          <span className="brand__mark" aria-hidden="true">
            ▮
          </span>
          <span>{SHORT_NAME}</span>
        </Link>
        <nav className="site-nav" aria-label="Main">
          <Link href="/demo">Live demo</Link>
          <Link href="/#pricing">Pricing</Link>
          <Link href="/connect" className="btn btn--small">
            Connect Stripe
          </Link>
        </nav>
      </div>
    </header>
  );
}
