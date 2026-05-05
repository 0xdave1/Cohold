import { ADMIN_REFRESH_COOKIE } from '@/lib/constants/auth-cookies';

/** Admin BFF proxy must not accept end-user refresh alone (prevents user session → admin API abuse). */
export function isAdminProxyAuthorized(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  return new RegExp(`(?:^|;\\s*)${ADMIN_REFRESH_COOKIE}=`).test(cookieHeader);
}
