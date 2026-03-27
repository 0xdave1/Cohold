'use client';

import { useEffect } from 'react';
import { bootstrapAuthFromCookie, useAuthStore } from '@/stores/auth.store';

/**
 * After persisted auth rehydrates, merge `cohold_user_access_token` from document.cookie
 * if Zustand still has no access token (e.g. Paystack return where cookie was sent but LS lagged).
 */
export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const run = () => bootstrapAuthFromCookie();
    if (useAuthStore.persist.hasHydrated()) {
      run();
    }
    return useAuthStore.persist.onFinishHydration(run);
  }, []);

  return <>{children}</>;
}
