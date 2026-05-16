import { createHmac } from 'node:crypto';

export const ADMIN_COOKIE = 'zb_admin';
const ADMIN_SESSION_HOURS = 24;

function secret(): string {
  return process.env.ADMIN_PASSWORD ?? 'dev-admin-secret';
}

export function mintAdminCookie(): string {
  const expiry = String(Date.now() + ADMIN_SESSION_HOURS * 3600 * 1000);
  const sig = createHmac('sha256', secret()).update(expiry).digest('hex');
  return `${expiry}.${sig}`;
}

export function verifyAdminCookie(value: string | undefined): boolean {
  if (!value) return false;
  const dot = value.lastIndexOf('.');
  if (dot === -1) return false;
  const expiry = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (Number(expiry) < Date.now()) return false;
  const expected = createHmac('sha256', secret()).update(expiry).digest('hex');
  return expected === sig;
}

export const adminCookieOptions = {
  name: ADMIN_COOKIE,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: ADMIN_SESSION_HOURS * 3600,
};
