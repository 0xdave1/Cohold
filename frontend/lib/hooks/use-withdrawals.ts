import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthReady } from '@/lib/hooks/use-auth-ready';
import {
  isWithdrawalNonTerminal,
  parseWithdrawalStatus,
  type WithdrawalStatus,
} from '@/lib/withdrawals/status';

export const WITHDRAWALS_QUERY_KEY = ['withdrawals'] as const;

export type { WithdrawalStatus };

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
  status: WithdrawalStatus | 'UNKNOWN';
  failureReason: string | null;
  providerReference?: string | null;
  providerTransferCode?: string | null;
  providerStatus?: string | null;
  providerLastCheckedAt?: string | null;
  reconciliationConflict?: boolean;
  reconciliationConflictReason?: string | null;
  reconciliationConflictAt?: string | null;
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

function normalizeWithdrawalPayload(raw: Omit<WithdrawalRecord, 'status'> & { status: string }): WithdrawalRecord {
  return {
    ...raw,
    status: parseWithdrawalStatus(raw.status),
  };
}

export function useWithdrawal(withdrawalId: string | null) {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: [...WITHDRAWALS_QUERY_KEY, withdrawalId],
    queryFn: async () => {
      if (!withdrawalId) return null;
      const res = await apiClient.get<Omit<WithdrawalRecord, 'status'> & { status: string }>(
        `/withdrawals/${withdrawalId}`,
      );
      if (!res.success) throw new Error(res.error ?? 'Failed to load withdrawal');
      return normalizeWithdrawalPayload(res.data);
    },
    enabled: !!withdrawalId && authReady,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s != null && isWithdrawalNonTerminal(s) ? 8000 : false;
    },
  });
}

export function useCreateWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      idempotencyKey: string;
      linkedBankAccountId: string;
      amount: string;
      currency: 'NGN';
      otp: string;
    }) => {
      const res = await apiClient.post<Omit<WithdrawalRecord, 'status'> & { status: string }>('/withdrawals', body);
      if (!res.success) throw new Error(res.error ?? 'Withdrawal failed');
      return normalizeWithdrawalPayload(res.data);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wallets', 'balances'] }),
        queryClient.invalidateQueries({ queryKey: ['wallets', 'transactions'] }),
        queryClient.invalidateQueries({ queryKey: [...WITHDRAWALS_QUERY_KEY] }),
      ]);
    },
  });
}
