import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

/**
 * Centralized mutation hooks for common operations.
 */

export function useCreateInvestment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      propertyId: string;
      amount: string;
      currency: string;
      clientReference: string;
    }) => {
      return apiClient.post('/investments/fractional', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
  });
}

export function useP2PTransfer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      recipientHandle: string;
      amount: string;
      clientReference?: string;
    }) => {
      return apiClient.post('/transfers/p2p', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
  });
}
