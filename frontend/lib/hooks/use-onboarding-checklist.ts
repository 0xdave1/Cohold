import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthReady } from '@/lib/hooks/use-auth-ready';

export type OnboardingChecklist = {
  emailVerified: boolean;
  kycSubmitted: boolean;
  kycVerified: boolean;
  virtualAccountActive: boolean;
  walletFunded: boolean;
  firstInvestmentCompleted: boolean;
  profileBasicsComplete: boolean;
  profilePhotoPresent: boolean;
  onboardingFlagSetAt: string | null;
  note?: string;
};

export function useOnboardingChecklist() {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ['users', 'me', 'onboarding-checklist'],
    queryFn: async () => {
      const res = await apiClient.get<OnboardingChecklist>('/users/me/onboarding-checklist');
      if (!res.success) throw new Error(res.error ?? 'Failed to load onboarding checklist');
      return res.data;
    },
    enabled: authReady,
    staleTime: 60_000,
  });
}
