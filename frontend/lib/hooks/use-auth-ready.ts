'use client';

import { useAuthStore } from '@/stores/auth.store';

/**
 * Returns true when auth bootstrap completed AND accessToken is present.
 * Use for React Query `enabled` to prevent API calls before auth is ready.
 */
export function useAuthReady(): boolean {
  const authChecked = useAuthStore((s) => s.authChecked);
  const accessToken = useAuthStore((s) => s.accessToken);

  return authChecked && !!accessToken;
}
