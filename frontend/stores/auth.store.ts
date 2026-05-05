import { create } from 'zustand';

export type AuthRole = 'user' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  username?: string | null;
  requiresUsernameSetup?: boolean;
  kycStatus?: string | null;
  onboardingCompletedAt?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  emailVerifiedAt?: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
  role: AuthRole | null;
  user: AuthUser | null;
  /** User JWT — memory only, never localStorage or cookies */
  accessToken: string | null;
  /** Admin JWT — memory only */
  adminAccessToken: string | null;
  hasHydrated: boolean;
  authChecked: boolean;
  setAuthChecked: (value: boolean) => void;
  setAccessToken: (token: string | null) => void;
  setAdminAccessToken: (token: string | null) => void;
  setSession: (payload: {
    role: AuthRole;
    user: AuthUser | null;
  }) => void;
  setUser: (user: AuthUser | null) => void;
  clearSession: () => void;
  /** Clears end-user session fields only (keeps admin access token). */
  clearUserSession: () => void;
  /** Clears admin JWT in memory only. */
  clearAdminSession: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  isAuthenticated: false,
  role: null,
  user: null,
  accessToken: null,
  adminAccessToken: null,
  hasHydrated: true,
  authChecked: false,

  setAuthChecked: (value) => set({ authChecked: value }),

  setAccessToken: (token) => set({ accessToken: token }),

  setAdminAccessToken: (token) => set({ adminAccessToken: token }),

  setSession: ({ role, user }) => {
    set({ isAuthenticated: true, role, user });
  },

  setUser: (user) => set({ user }),

  clearSession: () => {
    set({
      role: null,
      user: null,
      isAuthenticated: false,
      accessToken: null,
      adminAccessToken: null,
      authChecked: true,
    });
  },

  clearUserSession: () => {
    set({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      role: null,
    });
  },

  clearAdminSession: () => {
    set({ adminAccessToken: null });
  },
}));
