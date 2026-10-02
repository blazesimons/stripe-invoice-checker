/**
 * Deployment configuration. Everything here comes from environment variables so the
 * same build works for local dev and Vercel. See README.md for the full list.
 */

export const APP_NAME = 'Stripe Invoice Status Checker';
export const SHORT_NAME = 'Invoice Checker';
export const TAGLINE = 'See all unpaid invoices at a glance.';
export const PRICE_LABEL = '$19/month';

/**
 * Stripe Payment Link for the $19/month subscription (created by the account owner in
 * Stripe Dashboard -> Payment Links). Set NEXT_PUBLIC_STRIPE_PAYMENT_LINK on Vercel and
 * redeploy; until then the CTA falls back to the free "Connect Stripe" flow.
 */
export const PAYMENT_LINK: string = (process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? '').trim();

export function hasPaymentLink(): boolean {
  return /^https:\/\/(buy\.stripe\.com|checkout\.stripe\.com)\//.test(PAYMENT_LINK);
}

/** Stripe Connect OAuth is ready when a client id, a secret key and a session secret exist. */
export function oauthConfigured(): boolean {
  return Boolean(process.env.STRIPE_CLIENT_ID && process.env.STRIPE_SECRET_KEY);
}
