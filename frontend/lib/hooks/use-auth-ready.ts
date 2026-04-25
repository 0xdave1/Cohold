'use client';

import { useAuthStore } from '@/stores/auth.store';

/**
 * True after auth bootstrap finished and the session is cookie-backed + user hydrated.
 * Use for React Query `enabled` to avoid authenticated API calls before cookies/session are ready.
 */
export function useAuthReady(): boolean {
  const authChecked = useAuthStore((s) => s.authChecked);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return authChecked && isAuthenticated;
}
