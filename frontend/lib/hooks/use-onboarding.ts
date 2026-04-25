import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth.store';

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
  emailVerifiedAt?: string | null;
  createdAt?: string;
  /** Private object key in R2 (source of truth). */
  profilePhotoKey?: string | null;
  /** Short-lived signed URL for display; derived from `profilePhotoKey`. */
  profilePhotoUrl?: string | null;
  /** Compatibility alias from backend `/users/me`. */
  profileImageUrl?: string | null;
}

/** Initials for avatar fallback (first + last letter, or "U"). */
export function getProfileInitials(firstName?: string | null, lastName?: string | null): string {
  return [firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'U';
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

/**
 * READ-ONLY hook for fetching current user profile.
 * Does NOT sync data into Zustand - that would cause hydration mismatch.
 * Zustand auth store is the source of truth for auth state.
 * React Query is only for fetching fresh profile data.
 */
export function useMe(options?: { enabled?: boolean }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      const res = await apiClient.get<UserProfile>('/users/me');
      if (!res.success) throw new Error(res.error ?? 'Failed to fetch profile');
      return res.data;
    },
    enabled: options?.enabled !== false && hasHydrated && !!accessToken,
    refetchOnWindowFocus: true,
    refetchInterval: accessToken ? 30000 : false,
  });
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
