'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { CreateFractionalResponse } from '@/types/investment';

export function useCreateFractionalInvestment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      propertyId: string;
      shares: string;
      clientReference?: string;
    }) => {
      const res = await apiClient.post<CreateFractionalResponse>('/investments/fractional', payload);
      if (!res.success || !res.data) {
        throw new Error((res as { error?: string }).error ?? 'Investment failed');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['wallets', 'balances'] });
    },
  });
}
