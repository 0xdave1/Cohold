import {
  USER_REFRESH_COOKIE,
  ADMIN_REFRESH_COOKIE,
  USER_SITE_SESSION_COOKIE,
  ADMIN_SITE_SESSION_COOKIE,
} from '@/lib/constants/auth-cookies';

export function isAdminPublicPath(pathname: string): boolean {
  return pathname === '/admin/login' || pathname.startsWith('/admin/login/');
}

/** Protected admin UI (excludes login). */
export function isAdminProtectedPath(pathname: string): boolean {
  return pathname.startsWith('/admin') && !isAdminPublicPath(pathname);
}

export function isDashboardProtectedPath(pathname: string): boolean {
  return pathname.startsWith('/dashboard');
}

export interface MiddlewareAuthEnv {
  NODE_ENV: string;
  NEXT_PUBLIC_API_URL?: string;
  /** When `1`, middleware gates using HttpOnly site markers set by `/api/auth/establish-*` (cross-origin API). */
  NEXT_FIRST_PARTY_SESSION_COOKIES?: string;
}

export function parseMiddlewareAuthEnv(): MiddlewareAuthEnv {
  return {
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_FIRST_PARTY_SESSION_COOKIES: process.env.NEXT_FIRST_PARTY_SESSION_COOKIES,
  };
}

/**
 * API refresh cookies are visible on the app origin when the browser sends them here — same host
 * as `NEXT_PUBLIC_API_URL` or shared parent cookie domain on the API.
 */
export function shouldEnforceRefreshCookieGate(requestOrigin: string, nextPublicApiUrl?: string): boolean {
  const raw = nextPublicApiUrl?.trim();
  if (!raw) return false;
  try {
    return new URL(raw).origin === requestOrigin;
  } catch {
    return false;
  }
}

export function firstPartySiteSessionEnabled(env: MiddlewareAuthEnv): boolean {
  return env.NEXT_FIRST_PARTY_SESSION_COOKIES === '1';
}

/**
 * Production must not silently skip middleware protection when API is on another origin.
 * Operators either align origins / cookie domain, or enable first-party site session cookies.
 */
export function productionRequiresFirstPartyWhenApiCrossOrigin(
  env: MiddlewareAuthEnv,
  requestOrigin: string,
): boolean {
  if (env.NODE_ENV !== 'production') return false;
  if (shouldEnforceRefreshCookieGate(requestOrigin, env.NEXT_PUBLIC_API_URL)) return false;
  return !firstPartySiteSessionEnabled(env);
}

export interface CookieReader {
  has(name: string): boolean;
}

const FIRST_PARTY_ERR = 'first_party_session_required';

function misconfigurationRedirect(pathname: string, requestUrl: string): string {
  if (isAdminProtectedPath(pathname)) {
    const u = new URL('/admin/login', requestUrl);
    u.searchParams.set('err', FIRST_PARTY_ERR);
    return u.toString();
  }
  const u = new URL('/login', requestUrl);
  u.searchParams.set('err', FIRST_PARTY_ERR);
  if (isDashboardProtectedPath(pathname)) {
    u.searchParams.set('next', pathname);
  }
  return u.toString();
}

function hasUserMiddlewareCookie(cookies: CookieReader, env: MiddlewareAuthEnv, requestOrigin: string): boolean {
  const sameOriginApi = shouldEnforceRefreshCookieGate(requestOrigin, env.NEXT_PUBLIC_API_URL);
  const fp = firstPartySiteSessionEnabled(env);
  if (sameOriginApi && cookies.has(USER_REFRESH_COOKIE)) return true;
  if (fp && cookies.has(USER_SITE_SESSION_COOKIE)) return true;
  return false;
}

function hasAdminMiddlewareCookie(cookies: CookieReader, env: MiddlewareAuthEnv, requestOrigin: string): boolean {
  const sameOriginApi = shouldEnforceRefreshCookieGate(requestOrigin, env.NEXT_PUBLIC_API_URL);
  const fp = firstPartySiteSessionEnabled(env);
  if (sameOriginApi && cookies.has(ADMIN_REFRESH_COOKIE)) return true;
  if (fp && cookies.has(ADMIN_SITE_SESSION_COOKIE)) return true;
  return false;
}

function canEnforceUserGate(env: MiddlewareAuthEnv, requestOrigin: string): boolean {
  return (
    shouldEnforceRefreshCookieGate(requestOrigin, env.NEXT_PUBLIC_API_URL) || firstPartySiteSessionEnabled(env)
  );
}

function canEnforceAdminGate(env: MiddlewareAuthEnv, requestOrigin: string): boolean {
  return (
    shouldEnforceRefreshCookieGate(requestOrigin, env.NEXT_PUBLIC_API_URL) || firstPartySiteSessionEnabled(env)
  );
}

/**
 * Returns redirect URL when the route must not render without a first-party or API-visible session signal.
 */
export function getAuthMiddlewareRedirect(
  pathname: string,
  cookies: CookieReader,
  requestUrl: string,
  env: MiddlewareAuthEnv = parseMiddlewareAuthEnv(),
): string | null {
  const origin = new URL(requestUrl).origin;

  if (productionRequiresFirstPartyWhenApiCrossOrigin(env, origin)) {
    if (isDashboardProtectedPath(pathname) || isAdminProtectedPath(pathname)) {
      return misconfigurationRedirect(pathname, requestUrl);
    }
    return null;
  }

  if (isDashboardProtectedPath(pathname) && canEnforceUserGate(env, origin) && !hasUserMiddlewareCookie(cookies, env, origin)) {
    const u = new URL('/login', requestUrl);
    u.searchParams.set('next', pathname);
    return u.toString();
  }

  if (isAdminProtectedPath(pathname) && canEnforceAdminGate(env, origin) && !hasAdminMiddlewareCookie(cookies, env, origin)) {
    return new URL('/admin/login', requestUrl).toString();
  }

  return null;
}
