import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useAuthReady } from '@/lib/hooks/use-auth-ready';

export interface UserProfile {
  id: string;
  email: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  phoneCountryCode?: string | null;
  nationality?: string | null;
  houseNumber?: string | null;
  streetName?: string | null;
  city?: string | null;
  state?: string | null;
  kycStatus?: string | null;
  onboardingCompletedAt?: string | null;
  createdAt?: string;
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  phoneCountryCode?: string;
  phoneNumber?: string;
  nationality?: string;
  houseNumber?: string;
  streetName?: string;
  city?: string;
  state?: string;
}

const ME_QUERY_KEY = ['users', 'me'];

export function useMe(options?: { enabled?: boolean }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const authUser = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const role = useAuthStore((s) => s.role);
  const authReady = useAuthReady();

  const meQuery = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      const res = await apiClient.get<UserProfile>('/users/me');
      if (!res.success) throw new Error(res.error ?? 'Failed to fetch profile');
      return res.data;
    },
    enabled: options?.enabled !== false && authReady,
    refetchOnWindowFocus: true,
    refetchInterval: accessToken ? 30000 : false,
  });

  useEffect(() => {
    const profile = meQuery.data;
    if (!profile || !accessToken || !role) return;

    const hasChanged =
      authUser?.id !== profile.id ||
      authUser?.email !== profile.email ||
      authUser?.username !== profile.username ||
      authUser?.firstName !== profile.firstName ||
      authUser?.lastName !== profile.lastName ||
      authUser?.kycStatus !== profile.kycStatus ||
      authUser?.onboardingCompletedAt !== profile.onboardingCompletedAt;

    if (!hasChanged) return;

    setSession({
      accessToken,
      refreshToken,
      role,
      user: {
        id: profile.id,
        email: profile.email,
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
        kycStatus: profile.kycStatus,
        onboardingCompletedAt: profile.onboardingCompletedAt,
      },
    });
  }, [accessToken, authUser, meQuery.data, refreshToken, role, setSession]);

  return meQuery;
}

export interface PersonalDetailsPayload {
  firstName: string;
  lastName: string;
  phoneCountryCode: string;
  phoneNumber: string;
  nationality: string;
}

export interface ResidentialDetailsPayload {
  houseNumber: string;
  streetName: string;
  city: string;
  state: string;
}

export function useOnboarding() {
  const queryClient = useQueryClient();

  const updatePersonalDetailsMutation = useMutation({
    mutationFn: async (payload: PersonalDetailsPayload) => {
      const res = await apiClient.put<UserProfile>('/user/personal-details', payload);
      if (!res.success) throw new Error(res.error ?? 'Failed to save personal details');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });

  const updateResidentialDetailsMutation = useMutation({
    mutationFn: async (payload: ResidentialDetailsPayload) => {
      const res = await apiClient.put<UserProfile>('/user/residential-details', payload);
      if (!res.success) throw new Error(res.error ?? 'Failed to save residential details');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<UserProfile>('/users/me/complete-onboarding', {});
      if (!res.success) throw new Error(res.error ?? 'Failed to complete onboarding');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (payload: UpdateProfilePayload) => {
      const res = await apiClient.patch<UserProfile>('/users/me', payload);
      if (!res.success) throw new Error(res.error ?? 'Failed to update profile');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });

  return {
    updatePersonalDetails: updatePersonalDetailsMutation,
    updateResidentialDetails: updateResidentialDetailsMutation,
    updateProfile: updateProfileMutation,
    completeOnboarding: completeOnboardingMutation,
  };
}
