'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';

/**
 * True after Zustand persist has rehydrated AND accessToken is present.
 * Use for React Query `enabled` so we never hit the API unauthenticated before
 * localStorage/cookie bootstrap (important after Paystack redirect).
 */
export function useAuthReady(): boolean {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [hydrated, setHydrated] = useState(() =>
    typeof window !== 'undefined' ? useAuthStore.persist.hasHydrated() : false,
  );

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return unsub;
  }, []);

  return hydrated && !!accessToken;
}
