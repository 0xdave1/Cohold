import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthReady } from '@/lib/hooks/use-auth-ready';

export interface UserDistributionHistoryItem {
  id: string;
  amount: string;
  currency: string;
  status: string;
  failureReason?: string | null;
  ledgerOperationId?: string | null;
  createdAt: string;
  batch?: {
    id: string;
    propertyId: string;
    periodStart?: string | null;
    periodEnd?: string | null;
    status?: string;
  } | null;
  investment?: { id: string } | null;
}

export function useUserDistributionHistory(page = 1, limit = 20) {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ['distributions', 'me', page, limit],
    queryFn: async () => {
      const res = await apiClient.get<{ items: UserDistributionHistoryItem[]; meta: { page: number; limit: number; total: number } }>(
        '/distributions/me/history',
        { page, limit },
      );
      return res.success ? res.data : { items: [], meta: { page, limit, total: 0 } };
    },
    enabled: authReady,
  });
}

export function useAdminIncomeEvents(propertyId?: string, status?: string) {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ['admin', 'distributions', 'income-events', propertyId, status],
    queryFn: async () => {
      const res = await apiClient.get<any[]>('/admin/distributions/income-events', {
        ...(propertyId ? { propertyId } : {}),
        ...(status ? { status } : {}),
      });
      return res.success ? res.data : [];
    },
    enabled: authReady,
  });
}

export function useAdminDistributionBatches(propertyId?: string, status?: string) {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ['admin', 'distributions', 'batches', propertyId, status],
    queryFn: async () => {
      const res = await apiClient.get<any[]>('/admin/distributions/batches', {
        ...(propertyId ? { propertyId } : {}),
        ...(status ? { status } : {}),
      });
      return res.success ? res.data : [];
    },
    enabled: authReady,
  });
}

export function useAdminProcessDistributionBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (batchId: string) => {
      const res = await apiClient.post(`/admin/distributions/batches/${batchId}/process`, {});
      if (!res.success) throw new Error(res.error ?? 'Batch processing failed');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'distributions'] });
      queryClient.invalidateQueries({ queryKey: ['distributions', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['wallets', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallets', 'balances'] });
    },
  });
}

