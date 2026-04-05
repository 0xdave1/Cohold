import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AuthRole = 'user' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  username?: string | null;
  kycStatus?: string | null;
  onboardingCompletedAt?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  emailVerifiedAt?: string | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  role: AuthRole | null;
  user: AuthUser | null;
  hasHydrated: boolean;
  setSession: (payload: {
    accessToken: string;
    refreshToken?: string | null;
    role: AuthRole;
    user: AuthUser | null;
  }) => void;
  clearSession: () => void;
}

export const AUTH_COOKIE_NAME = 'cohold_user_access_token';
const AUTH_COOKIE_MAX_AGE = 60 * 15;

function cookieSuffixSecure(): string {
  if (typeof window === 'undefined') return '';
  return window.location.protocol === 'https:' ? '; secure' : '';
}

function setAuthCookie(token: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${AUTH_COOKIE_MAX_AGE}; samesite=lax${cookieSuffixSecure()}`;
}

function clearAuthCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; samesite=lax${cookieSuffixSecure()}`;
}

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

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      role: null,
      user: null,
      hasHydrated: false,

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
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        role: state.role,
        user: state.user,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Failed to rehydrate auth store', error);
        }
        // Set hasHydrated ONLY via direct set to avoid side effects
        if (state) {
          useAuthStore.setState({ hasHydrated: true });
        }
      },
    },
  ),
);