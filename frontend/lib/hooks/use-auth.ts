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
    kycStatus: profile.kycStatus,
    onboardingCompletedAt: profile.onboardingCompletedAt,
    firstName: profile.firstName,
    lastName: profile.lastName,
    emailVerifiedAt: profile.emailVerifiedAt ?? null,
  };
}

async function finalizeUserSession(params: {
  accessToken: string;
  refreshToken: string | null;
  setSession: ReturnType<typeof useAuthStore.getState>['setSession'];
  clearSession: ReturnType<typeof useAuthStore.getState>['clearSession'];
}) {
  const { accessToken, refreshToken, setSession, clearSession } = params;

  try {
    const profileRes = await apiClient.get<MeResponse>('/users/me');

    if (!profileRes.success || !profileRes.data) {
      throw new Error(profileRes.error ?? 'Failed to load profile');
    }

    setSession({
      accessToken,
      refreshToken,
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
 * Auth mutations and helpers.
 *
 * - Signup → request OTP → verify OTP → complete-signup (token + fetch /users/me → store → redirect to onboarding)
 * - Login → token + fetch /users/me → store → redirect to dashboard
 * - Logout clears Zustand session, React Query cache, and redirects to login
 * - 401 with Bearer: API client attempts refresh; session clears only if refresh fails
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
        accessToken: string;
        refreshToken?: string;
      }>('/auth/complete-signup', data);

      if (!res.success || !res.data?.accessToken) {
        throw new Error(res.error ?? 'Signup completion failed');
      }

      const accessToken = res.data.accessToken;
      const refreshToken = res.data.refreshToken ?? null;

      await finalizeUserSession({
        accessToken,
        refreshToken,
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
        accessToken: string;
        refreshToken?: string;
      }>('/auth/login', data);

      if (!res.success || !res.data?.accessToken) {
        throw new Error(res.error ?? 'Login failed');
      }

      const accessToken = res.data.accessToken;
      const refreshToken = res.data.refreshToken ?? null;

      await finalizeUserSession({
        accessToken,
        refreshToken,
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
      const { refreshToken, user } = useAuthStore.getState();

      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const res = await apiClient.post<{ accessToken: string; refreshToken?: string }>('/auth/refresh', {
        refreshToken,
      });

      if (!res.success || !res.data?.accessToken) {
        throw new Error(res.error ?? 'Refresh failed');
      }

      setSession({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken ?? refreshToken,
        role: 'user',
        user: user ?? null,
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
    clearSession();
    queryClient.clear();
    router.push('/login');
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
    getApiErrorMessage,
  };
}