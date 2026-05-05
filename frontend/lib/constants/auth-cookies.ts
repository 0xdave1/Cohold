/**
 * Auth/session cookie names shared across middleware, API routes, and tests.
 * Keep these server-safe constants free of browser-only imports.
 */
export const USER_REFRESH_COOKIE = 'cohold_refresh_token' as const;
export const ADMIN_REFRESH_COOKIE = 'cohold_admin_refresh_token' as const;
export const CSRF_COOKIE = 'cohold_csrf_token' as const;

/** First-party site-session markers on the Next.js origin (Issue 4). */
export const USER_SITE_SESSION_COOKIE = '__cohold_user_site_session' as const;
export const ADMIN_SITE_SESSION_COOKIE = '__cohold_admin_site_session' as const;
