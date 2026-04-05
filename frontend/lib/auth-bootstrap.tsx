'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  AUTH_COOKIE_NAME,
  getCookieValue,
  useAuthStore,
} from '@/stores/auth.store';

/**
 * Safe auth bootstrap hook.
 * - Runs ONLY in useEffect (client-side, after hydration)
 * - Waits for Zustand hasHydrated flag
 * - Syncs cookie -> store ONLY if store has no accessToken
 * - Never triggers side effects during SSR or hydration
 */
export function useAuthBootstrap(): { isReady: boolean } {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setSession = useAuthStore((s) => s.setSession);
  const [isBootstrapped, setIsBootstrapped] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;

    // Already have a token from persisted store, no need to bootstrap
    if (accessToken) {
      setIsBootstrapped(true);
      return;
    }

    // Try to recover token from cookie (e.g., Paystack redirect scenario)
    const cookieToken = getCookieValue(AUTH_COOKIE_NAME);
    if (cookieToken) {
      // Get current state to preserve any existing user/role
      const state = useAuthStore.getState();
      setSession({
        accessToken: cookieToken,
        refreshToken: state.refreshToken,
        role: state.role ?? 'user',
        user: state.user ?? null,
      });
    }

    setIsBootstrapped(true);
  }, [hasHydrated, accessToken, setSession]);

  return { isReady: hasHydrated && isBootstrapped };
}

/**
 * Auth bootstrap wrapper component.
 * Blocks children until hydration + bootstrap is complete.
 * Use in root layout to ensure auth state is ready before rendering.
 */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const { isReady } = useAuthBootstrap();

  if (!isReady) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Hook to safely access auth state.
 * Returns null values until hydration is complete.
 * Use this in components that need auth state but want to avoid hydration mismatch.
 */
export function useSafeAuth() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);

  if (!hasHydrated) {
    return {
      isReady: false,
      accessToken: null,
      user: null,
      role: null,
    } as const;
  }

  return {
    isReady: true,
    accessToken,
    user,
    role,
  } as const;
}
