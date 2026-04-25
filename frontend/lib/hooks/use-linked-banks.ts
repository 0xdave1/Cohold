import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthReady } from '@/lib/hooks/use-auth-ready';

export interface LinkedBank {
  id: string;
  accountNumber: string;
  bankName: string;
  accountName: string;
  currency: string;
  isDefault: boolean;
  isVerified?: boolean;
  bankCode?: string | null;
}

export interface SupportedBank {
  code: string;
  name: string;
}

const KEY = ['users', 'me', 'linked-banks'];
const BANKS_KEY = ['users', 'me', 'linked-banks', 'banks'];

export function useLinkedBanks() {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await apiClient.get<{ items: LinkedBank[] }>('/users/me/linked-banks');
      if (!res.success) throw new Error(res.error ?? 'Failed to fetch linked banks');
      return res.data.items ?? [];
    },
    enabled: authReady,
  });
}

export function useAddLinkedBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      currency: 'NGN';
      accountNumber: string;
      bankCode: string;
      isDefault?: boolean;
    }) => {
      const res = await apiClient.post<{ id: string }>('/users/me/linked-banks', data);
      if (!res.success) throw new Error(res.error ?? 'Failed to add bank');
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSupportedBanks() {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: BANKS_KEY,
    queryFn: async () => {
      const res = await apiClient.get<{ items: SupportedBank[] }>('/users/me/linked-banks/banks');
      if (!res.success) throw new Error(res.error ?? 'Failed to fetch banks');
      return res.data.items ?? [];
    },
    enabled: authReady,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRemoveLinkedBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.del<{ message: string }>(`/users/me/linked-banks/${id}`);
      if (!res.success) throw new Error(res.error ?? 'Failed to remove bank');
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
