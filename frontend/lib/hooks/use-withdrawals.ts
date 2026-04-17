import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthReady } from '@/lib/hooks/use-auth-ready';

export const WITHDRAWALS_QUERY_KEY = ['withdrawals'] as const;

export type WithdrawalStatusUi =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface WithdrawalRecipientBank {
  id: string;
  accountNumber?: string;
  bankName?: string;
  accountName?: string;
  bankCode?: string | null;
  currency: string;
}

export interface WithdrawalRecord {
  id: string;
  reference: string;
  amount: string;
  fee: string;
  netAmount: string;
  currency: string;
  status: WithdrawalStatusUi;
  failureReason: string | null;
  initiatedAt: string;
  processedAt: string | null;
  completedAt: string | null;
  linkedBankAccountId: string;
  recipientBank: WithdrawalRecipientBank;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface WithdrawalsListResponse {
  items: WithdrawalRecord[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function useWithdrawal(withdrawalId: string | null) {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: [...WITHDRAWALS_QUERY_KEY, withdrawalId],
    queryFn: async () => {
      if (!withdrawalId) return null;
      const res = await apiClient.get<WithdrawalRecord>(`/withdrawals/${withdrawalId}`);
      if (!res.success) throw new Error(res.error ?? 'Failed to load withdrawal');
      return res.data;
    },
    enabled: !!withdrawalId && authReady,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === 'PENDING' || s === 'PROCESSING' ? 8000 : false;
    },
  });
}

export function useCreateWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      linkedBankAccountId: string;
      amount: string;
      currency: 'NGN';
      otp: string;
    }) => {
      const res = await apiClient.post<WithdrawalRecord>('/withdrawals', body);
      if (!res.success) throw new Error(res.error ?? 'Withdrawal failed');
      return res.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wallets', 'balances'] }),
        queryClient.invalidateQueries({ queryKey: [...WITHDRAWALS_QUERY_KEY] }),
      ]);
    },
  });
}
