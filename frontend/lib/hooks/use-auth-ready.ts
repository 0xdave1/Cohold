'use client';

import { useAuthStore } from '@/stores/auth.store';

/**
 * Returns true when Zustand has rehydrated AND accessToken is present.
 * Use for React Query `enabled` to prevent API calls before auth is ready.
 */
export function useAuthReady(): boolean {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);

  return hasHydrated && !!accessToken;
}
