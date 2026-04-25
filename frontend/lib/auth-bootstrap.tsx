'use client';

import { type ReactNode, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api/client';

/**
 * Cookie-only auth bootstrap:
 * - POST /auth/refresh (cookies + CSRF) then GET /users/me
 * - store user in Zustand only; no access/refresh tokens in JS
 */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const authChecked = useAuthStore((s) => s.authChecked);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const setAuthChecked = useAuthStore((s) => s.setAuthChecked);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const refresh = await apiClient.post<{ requiresUsernameSetup?: boolean }>('/auth/refresh', {});
        if (!refresh.success) {
          throw new Error(refresh.error ?? 'Unauthenticated');
        }
        const me = await apiClient.get<{
          id: string;
          email: string;
          username?: string | null;
          requiresUsernameSetup?: boolean;
          kycStatus?: string | null;
          onboardingCompletedAt?: string | null;
          firstName?: string | null;
          lastName?: string | null;
          emailVerifiedAt?: string | null;
        }>('/users/me');
        if (!me.success || !me.data) {
          throw new Error(me.error ?? 'Failed to load profile');
        }
        if (cancelled) return;
        setSession({
          role: 'user',
          user: {
            id: me.data.id,
            email: me.data.email,
            username: me.data.username ?? null,
            requiresUsernameSetup: me.data.requiresUsernameSetup ?? (me.data.username == null),
            kycStatus: me.data.kycStatus ?? null,
            onboardingCompletedAt: me.data.onboardingCompletedAt ?? null,
            firstName: me.data.firstName ?? null,
            lastName: me.data.lastName ?? null,
            emailVerifiedAt: me.data.emailVerifiedAt ?? null,
          },
        });
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    }
    if (!authChecked) {
      void bootstrap();
    }
    return () => {
      cancelled = true;
    };
  }, [authChecked, setAuthChecked, setSession, clearSession]);

  if (!authChecked) {
    return null;
  }

  return <>{children}</>;
}
