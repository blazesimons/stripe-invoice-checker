import type { NextRequest } from 'next/server';

/**
 * Public origin of this deployment, used to build the OAuth redirect_uri. Behind
 * Vercel's proxy the forwarded headers are authoritative; APP_URL overrides everything
 * (useful when a custom domain is attached).
 */
export function baseUrl(req: NextRequest): string {
  const fromEnv = process.env.APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!host) return req.nextUrl.origin;
  const proto =
    req.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}
