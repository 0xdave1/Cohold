import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthReady } from '@/lib/hooks/use-auth-ready';

export interface ReferralItem {
  id: string;
  name: string;
  date: string;
  earnings: string;
}

export interface ReferralsResponse {
  referralCode: string | null;
  earnings: string;
  referrals: ReferralItem[];
}

export function useReferrals() {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ['users', 'me', 'referrals'],
    queryFn: async () => {
      const res = await apiClient.get<ReferralsResponse>('/users/me/referrals');
      if (!res.success) throw new Error(res.error ?? 'Failed to fetch referrals');
      return res.data;
    },
    enabled: authReady,
  });
}
