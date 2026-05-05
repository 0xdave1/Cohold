import { CSRF_COOKIE } from '@/lib/constants/auth-cookies';

/** Backend sets `cohold_csrf_token` with httpOnly: false for double-submit CSRF. */
export function readCsrfCookieFromDocument(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const prefix = `${CSRF_COOKIE}=`;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const p = part.trim();
    if (p.startsWith(prefix)) {
      return decodeURIComponent(p.slice(prefix.length));
    }
  }
  return undefined;
}
