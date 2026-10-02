import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Stateless session: the Stripe OAuth access token is sealed with AES-256-GCM into an
 * httpOnly cookie. Nothing is persisted server-side (PRD: "session state only").
 */

export const SESSION_COOKIE = 'sic_session';
export const OAUTH_STATE_COOKIE = 'sic_oauth_state';
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export interface Session {
  accessToken: string;
  accountId: string;
  livemode: boolean;
  connectedAt: number;
}

function sessionKey(): Buffer | null {
  const secret = process.env.SESSION_SECRET || process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return createHash('sha256').update(secret).digest();
}

export function sessionsAvailable(): boolean {
  return sessionKey() !== null;
}

export function sealSession(session: Session): string | null {
  const key = sessionKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(session), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, ciphertext, tag].map((b) => b.toString('base64url')).join('.');
}

export function openSession(token: string | undefined | null): Session | null {
  if (!token) return null;
  const key = sessionKey();
  if (!key) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const [iv, ciphertext, tag] = parts.map((p) => Buffer.from(p, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const parsed: unknown = JSON.parse(plaintext);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as Session).accessToken === 'string' &&
      typeof (parsed as Session).accountId === 'string'
    ) {
      const s = parsed as Session;
      if (Date.now() - s.connectedAt > SESSION_MAX_AGE_SECONDS * 1000) return null;
      return s;
    }
    return null;
  } catch {
    return null;
  }
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
