import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { getApiErrorMessage } from '@/lib/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'next/navigation';

/** User profile shape returned by GET /users/me */
export interface MeResponse {
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

function mapMeToAuthUser(profile: MeResponse) {
  return {
    id: profile.id,
    email: profile.email,
    username: profile.username,
    requiresUsernameSetup: profile.requiresUsernameSetup ?? (profile.username == null),
    kycStatus: profile.kycStatus,
    onboardingCompletedAt: profile.onboardingCompletedAt,
    firstName: profile.firstName,
    lastName: profile.lastName,
    emailVerifiedAt: profile.emailVerifiedAt ?? null,
  };
}

async function finalizeUserSession(params: {
  setSession: ReturnType<typeof useAuthStore.getState>['setSession'];
  clearSession: ReturnType<typeof useAuthStore.getState>['clearSession'];
}) {
  const { setSession, clearSession } = params;

  try {
    const profileRes = await apiClient.get<MeResponse>('/users/me');

    if (!profileRes.success || !profileRes.data) {
      throw new Error(profileRes.error ?? 'Failed to load profile');
    }

    setSession({
      role: 'user',
      user: mapMeToAuthUser(profileRes.data),
    });

    return profileRes.data;
  } catch (error) {
    clearSession();
    throw error;
  }
}

/**
 * Auth mutations and helpers (HttpOnly cookies + CSRF; no tokens in JS).
 *
 * - Signup → OTP → complete-signup → cookies set → GET /users/me → store user → onboarding
 * - Login → cookies set → GET /users/me → store user → dashboard
 * - Logout → POST /auth/logout → clear in-memory user + React Query → login
 * - 401 on API calls: client POST /auth/refresh (with cookies + CSRF), then retries; session clears if refresh fails
 */
export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  const signupMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; referralCode?: string }) => {
      return apiClient.post<{ message: string; email: string }>('/auth/signup', data);
    },
  });

  const requestOtpMutation = useMutation({
    mutationFn: async (data: { email: string; purpose?: 'signup' | 'login' | 'transaction' | 'delete_account' }) => {
      return apiClient.post<{ message?: string }>('/auth/request-otp', data);
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      otp: string;
      purpose?: 'signup' | 'login' | 'transaction' | 'delete_account';
    }) => {
      return apiClient.post<unknown>('/auth/verify-otp', data);
    },
  });

  const completeSignupMutation = useMutation({
    mutationFn: async (data: { email: string; otp: string }) => {
      const res = await apiClient.post<{
        requiresUsernameSetup?: boolean;
      }>('/auth/complete-signup', data);

      if (!res.success) {
        throw new Error(res.error ?? 'Signup completion failed');
      }

      await finalizeUserSession({
        setSession,
        clearSession,
      });

      return res;
    },
    onSuccess: () => {
      router.push('/onboarding/personal-details');
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await apiClient.post<{
        requiresUsernameSetup?: boolean;
      }>('/auth/login', data);

      if (!res.success) {
        throw new Error(res.error ?? 'Login failed');
      }

      await finalizeUserSession({
        setSession,
        clearSession,
      });

      return res;
    },
    onSuccess: () => {
      router.push('/dashboard');
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ requiresUsernameSetup?: boolean }>('/auth/refresh', {});

      if (!res.success) {
        throw new Error(res.error ?? 'Refresh failed');
      }
      const profileRes = await apiClient.get<MeResponse>('/users/me');
      if (!profileRes.success || !profileRes.data) {
        throw new Error(profileRes.error ?? 'Failed to load profile');
      }

      setSession({
        role: 'user',
        user: mapMeToAuthUser(profileRes.data),
      });

      return res.data;
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: { email: string }) => {
      return apiClient.post<{ message?: string }>('/auth/request-otp', {
        email: data.email,
        purpose: 'login',
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { email: string; otp: string; newPassword: string; confirmPassword: string }) => {
      if (data.newPassword !== data.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      return apiClient.post<unknown>('/auth/reset-password', {
        email: data.email,
        otp: data.otp,
        newPassword: data.newPassword,
      });
    },
    onSuccess: () => {
      router.push('/login');
    },
  });

  const logout = () => {
    void apiClient
      .post('/auth/logout', {})
      .catch(() => undefined)
      .finally(() => {
        clearSession();
        queryClient.clear();
        router.push('/login');
      });
  };

  const logoutAll = () => {
    void apiClient
      .post('/auth/logout-all', {})
      .catch(() => undefined)
      .finally(() => {
        clearSession();
        queryClient.clear();
        router.push('/login');
      });
  };

  return {
    signup: signupMutation,
    requestOtp: requestOtpMutation,
    verifyOtp: verifyOtpMutation,
    completeSignup: completeSignupMutation,
    login: loginMutation,
    refresh: refreshMutation,
    forgotPassword: forgotPasswordMutation,
    resetPassword: resetPasswordMutation,
    logout,
    logoutAll,
    getApiErrorMessage,
  };
}