import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthReady } from '@/lib/hooks/use-auth-ready';
import {
  FLUTTERWAVE_WALLET_FUNDING_INITIALIZE_PATH,
  flutterwaveWalletFundingVerifyPath,
} from '@/lib/constants/wallet-funding';
import type Decimal from 'decimal.js';
import { formatDecimalMoneyForDisplay } from '@/lib/money/format-display';

export interface WalletBalance {
  id: string;
  currency: 'NGN' | 'USD' | 'GBP' | 'EUR';
  balance: string; // Decimal string
}

export interface Transaction {
  id: string;
  reference: string;
  type: string;
  status: string;
  amount: string;
  currency: string;
  direction: 'CREDIT' | 'DEBIT';
  createdAt: string;
  /** Links this leg to a `LedgerOperation` when the backend has posted under Issue 3. */
  ledgerOperationId?: string | null;
}

export interface VirtualAccount {
  id: string;
  accountNumber: string;
  bankName: string;
  currency: string;
  accountName: string;
}

export function useVirtualAccounts() {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ['wallets', 'virtual-accounts'],
    queryFn: async () => {
      const res = await apiClient.get<VirtualAccount[]>('/wallets/virtual-accounts');
      return res.success ? res.data : [];
    },
    enabled: authReady,
    staleTime: 60000,
  });
}

/**
 * Wallet hooks for TanStack Query.
 */
export function useWalletBalances() {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ['wallets', 'balances'],
    queryFn: async () => {
      const res = await apiClient.get<WalletBalance[]>('/wallets/balances');
      return res.success ? res.data : [];
    },
    enabled: authReady,
    staleTime: 0,
    refetchOnMount: true,
  });
}

export interface InitializePaymentResponse {
  checkoutUrl: string;
  reference: string;
}

/**
 * Starts Flutterwave-hosted checkout only (server: `PaymentsController` initialize).
 * Never use a removed self-credit wallet route.
 */
export function useInitializeWalletPayment() {
  return useMutation({
    mutationFn: async (body: { amount: string; currency: 'NGN' }) => {
      const res = await apiClient.post<InitializePaymentResponse>(
        FLUTTERWAVE_WALLET_FUNDING_INITIALIZE_PATH,
        body,
      );
      if (!res.success || !res.data?.checkoutUrl) {
        throw new Error(res.error ?? 'Failed to initialize payment');
      }
      return res.data;
    },
  });
}

/** After Flutterwave redirect; confirms payment server-side before wallet balance updates. */
export function useVerifyWalletPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reference: string) => {
      const res = await apiClient.get(flutterwaveWalletFundingVerifyPath(reference));
      if (!res.success) {
        throw new Error(res.error ?? 'Failed to verify payment');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['wallets', 'transactions'] });
    },
  });
}

/** Dev-only: POST /wallets/dev-credit */
export function useDevWalletCredit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { amount: string; currency: 'NGN' }) => {
      const res = await apiClient.post<unknown>('/wallets/dev-credit', body);
      if (!res.success) throw new Error(res.error ?? 'Dev credit failed');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['wallets', 'transactions'] });
    },
  });
}

export function useWalletSwap() {
  return useMutation({
    mutationFn: async () => {
      throw new Error('Swap feature coming soon');
    },
  });
}

export interface TransactionFilters {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  direction?: string;
  currency?: string;
  q?: string;
}

export function useWalletTransactions(filters: TransactionFilters = {}) {
  const authReady = useAuthReady();
  const { page = 1, limit = 20, type, status, direction, currency, q } = filters;
  return useQuery({
    queryKey: ['wallets', 'transactions', page, limit, type, status, direction, currency, q],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit };
      if (type) params.type = type;
      if (status) params.status = status;
      if (direction) params.direction = direction;
      if (currency) params.currency = currency;
      if (q) params.q = q;
      const res = await apiClient.get<{
        items: Transaction[];
        meta: { page: number; limit: number; total: number };
      }>('/wallets/transactions', params);
      return res.success ? res.data : { items: [], meta: { page, limit, total: 0 } };
    },
    enabled: authReady,
  });
}

/** Format backend decimal strings for UI without floating-point conversion. */
export function formatMoney(amount: string | Decimal, currency: string): string {
  return formatDecimalMoneyForDisplay(amount, currency);
}
