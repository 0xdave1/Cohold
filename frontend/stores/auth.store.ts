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
  accessToken: string | null;
  isAuthenticated: boolean;
  role: AuthRole | null;
  user: AuthUser | null;
  hasHydrated: boolean;
  authChecked: boolean;
  setAuthChecked: (value: boolean) => void;
  setSession: (payload: {
    role: AuthRole;
    user: AuthUser | null;
  }) => void;
  setUser: (user: AuthUser | null) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  isAuthenticated: false,
  role: null,
  user: null,
  hasHydrated: true,
  authChecked: false,

  setAuthChecked: (value) => set({ authChecked: value }),

  setSession: ({ role, user }) => {
    set({ accessToken: 'cookie-session', isAuthenticated: true, role, user });
  },

  setUser: (user) => set({ user }),

  clearSession: () => {
    set({
      role: null,
      user: null,
      accessToken: null,
      isAuthenticated: false,
      authChecked: true,
    });
  },
}));