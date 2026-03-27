import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AuthRole = 'user' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  username?: string | null;
  kycStatus?: string | null;
  onboardingCompletedAt?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  role: AuthRole | null;
  user: AuthUser | null;
  setSession: (payload: {
    accessToken: string;
    refreshToken?: string | null;
    role: AuthRole;
    user: AuthUser;
  }) => void;
  clearSession: () => void;
}

/** HttpOnly-less cookie for Next.js middleware + post–external-redirect (e.g. Paystack) */
export const AUTH_COOKIE_NAME = 'cohold_user_access_token';
const AUTH_COOKIE_MAX_AGE = 60 * 15; // 15 minutes (match access token TTL)

function cookieSuffixSecure(): string {
  if (typeof window === 'undefined') return '';
  return window.location.protocol === 'https:' ? '; secure' : '';
}

function setAuthCookie(token: string) {
  if (typeof document === 'undefined') return;
  // SameSite=Lax: cookie is sent on top-level navigation back from Paystack.
  // SameSite=Strict would NOT send the cookie on that first request → middleware → /login.
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${AUTH_COOKIE_MAX_AGE}; samesite=lax${cookieSuffixSecure()}`;
}

function clearAuthCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; samesite=lax${cookieSuffixSecure()}`;
}

/** Read a non-httpOnly cookie (client-side). */
export function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const p = part.trim();
    if (p.startsWith(prefix)) {
      return decodeURIComponent(p.slice(prefix.length));
    }
  }
  return null;
}

/**
 * After Zustand rehydrates, if localStorage had no token but the cookie still exists
 * (e.g. return from Paystack before persist replays), sync cookie → store.
 */
export function bootstrapAuthFromCookie(): void {
  const state = useAuthStore.getState();
  const fromCookie = getCookieValue(AUTH_COOKIE_NAME);
  if (!fromCookie || state.accessToken) return;
  state.setSession({
    accessToken: fromCookie,
    refreshToken: state.refreshToken,
    role: state.role ?? 'user',
    user: state.user ?? { id: '', email: '' },
  });
}

/**
 * Auth state with Zustand + persist.
 *
 * - accessToken, role, user (and optionally refreshToken) stored and persisted to localStorage
 * - Cookie cohold_user_access_token set for middleware / protected routes
 * - setSession: call after login or complete-signup; cookie + state updated
 * - clearSession: call on logout or when refresh fails
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      role: null,
      user: null,
      setSession: ({ accessToken, refreshToken = null, role, user }) => {
        setAuthCookie(accessToken);
        set({
          accessToken,
          refreshToken: refreshToken ?? null,
          role,
          user,
        });
      },
      clearSession: () => {
        clearAuthCookie();
        set({
          accessToken: null,
          refreshToken: null,
          role: null,
          user: null,
        });
      },
    }),
    {
      name: 'cohold-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        role: state.role,
        user: state.user,
      }),
    },
  ),
);
