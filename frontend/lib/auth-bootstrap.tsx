'use client';

import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import {
  apiClient,
  extractAccessTokenFromEnvelope,
  postWithCredentialsOnly,
} from '@/lib/api/client';
import type { ApiResponse } from '@/lib/api/client';
import { isAdminPublicPath, isAdminProtectedPath, isDashboardProtectedPath } from '@/lib/middleware-auth';
import { establishAdminSiteSession, establishUserSiteSession } from '@/lib/site-session';

/**
 * Bootstrap: HttpOnly refresh cookies + access JWT in memory.
 * User and admin domains are isolated — user refresh failure must not clear admin tokens.
 */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const authChecked = useAuthStore((s) => s.authChecked);
  const setSession = useAuthStore((s) => s.setSession);
  const clearUserSession = useAuthStore((s) => s.clearUserSession);
  const clearAdminSession = useAuthStore((s) => s.clearAdminSession);
  const setAuthChecked = useAuthStore((s) => s.setAuthChecked);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setAdminAccessToken = useAuthStore((s) => s.setAdminAccessToken);
  const prevPathRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const prev = prevPathRef.current;
    if (prev !== null && prev !== pathname) {
      if (isAdminProtectedPath(pathname) && !useAuthStore.getState().adminAccessToken) {
        setAuthChecked(false);
      }
      if (isDashboardProtectedPath(pathname) && !useAuthStore.getState().isAuthenticated) {
        setAuthChecked(false);
      }
    }
    prevPathRef.current = pathname;
  }, [pathname, setAuthChecked]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrapUser() {
      try {
        const refresh = await postWithCredentialsOnly<
          ApiResponse<{ accessToken?: string; requiresUsernameSetup?: boolean }>
        >('/auth/refresh', {});
        if (!refresh.data.success) {
          throw new Error('Unauthenticated');
        }
        const token = extractAccessTokenFromEnvelope(refresh.data);
        if (token) setAccessToken(token);

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
        clearAdminSession();
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
        const ut = useAuthStore.getState().accessToken;
        if (ut && !cancelled) await establishUserSiteSession(ut);
      } catch {
        if (!cancelled) clearUserSession();
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    }

    async function bootstrapAdmin() {
      try {
        const refresh = await postWithCredentialsOnly<ApiResponse<{ accessToken?: string }>>(
          '/admin-auth/refresh',
          {},
        );
        if (!refresh.data.success) {
          throw new Error('Unauthenticated');
        }
        const token = extractAccessTokenFromEnvelope(refresh.data);
        if (token) setAdminAccessToken(token);

        const me = await apiClient.get<{ user: { email?: string; role?: string } }>('/admin-auth/me');
        if (!me.success || !me.data?.user) {
          throw new Error(me.error ?? 'Failed to load admin session');
        }
        if (cancelled) return;
        clearUserSession();
        const at = useAuthStore.getState().adminAccessToken;
        if (at && !cancelled) await establishAdminSiteSession(at);
      } catch {
        if (!cancelled) clearAdminSession();
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    }

    async function bootstrapPublicAdminLogin() {
      if (!cancelled) setAuthChecked(true);
    }

    if (!authChecked) {
      if (isAdminPublicPath(pathname)) {
        void bootstrapPublicAdminLogin();
      } else if (isAdminProtectedPath(pathname)) {
        void bootstrapAdmin();
      } else {
        void bootstrapUser();
      }
    }

    return () => {
      cancelled = true;
    };
  }, [
    authChecked,
    pathname,
    setAuthChecked,
    setSession,
    clearUserSession,
    clearAdminSession,
    setAccessToken,
    setAdminAccessToken,
  ]);

  if (!authChecked) {
    return null;
  }

  return <>{children}</>;
}
