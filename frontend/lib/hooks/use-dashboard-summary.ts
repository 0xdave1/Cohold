import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthReady } from '@/lib/hooks/use-auth-ready';

export type WalletBalanceRow = { currency: string; balance: string };

export type DashboardSummary = {
  walletBalances: WalletBalanceRow[];
  pendingWithdrawals: { count: number; totalNetAmount: string };
  activeInvestments: { count: number; principalInvested: string };
  paidDistributionsFromPayouts: {
    payoutCount: number;
    totalAmount: string;
    note?: string;
  };
  projectedPortfolioYield: {
    value: string | null;
    unsupportedReason?: string | null;
  };
  kycStatus: string;
  virtualAccount: {
    status: string;
    accountNumberLast4: string | null;
    bankName: string | null;
  };
  unreadNotificationsCount: number;
  openSupportTicketsCount: number;
  unsupported?: {
    secondaryMarketLiquidity?: { value: null; unsupportedReason?: string };
  };
};

/**
 * Issue 12: backend-only aggregates for dashboard truthfulness (no invented metrics).
 */
export function useDashboardSummary() {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ['users', 'me', 'dashboard-summary'],
    queryFn: async () => {
      const res = await apiClient.get<DashboardSummary>('/users/me/dashboard-summary');
      if (!res.success) throw new Error(res.error ?? 'Failed to load dashboard summary');
      return res.data;
    },
    enabled: authReady,
    staleTime: 30_000,
  });
}
