import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthReady } from '@/lib/hooks/use-auth-ready';
import Decimal from 'decimal.js';

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

export function useWalletTopUp() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      currency: 'NGN' | 'USD' | 'GBP' | 'EUR';
      amount: string;
      clientReference?: string;
    }) => {
      return apiClient.post('/wallets/top-up', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
  });
}

export interface InitializePaymentResponse {
  authorizationUrl: string;
  reference: string;
}

/** Paystack card checkout to fund wallet */
export function useInitializeWalletPayment() {
  return useMutation({
    mutationFn: async (body: { amount: string; currency: 'NGN' }) => {
      const res = await apiClient.post<InitializePaymentResponse>('/payments/initialize', body);
      if (!res.success || !res.data?.authorizationUrl) {
        throw new Error(res.error ?? 'Failed to initialize payment');
      }
      return res.data;
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
    },
  });
}

export function useWalletSwap() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      fromCurrency: 'NGN' | 'USD' | 'GBP' | 'EUR';
      toCurrency: 'NGN' | 'USD' | 'GBP' | 'EUR';
      amount: string;
      clientReference?: string;
    }) => {
      return apiClient.post('/wallets/swap', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
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

/**
 * Format money for display using Intl.NumberFormat.
 */
export function formatMoney(amount: string | Decimal, currency: string): string {
  const decimal = typeof amount === 'string' ? new Decimal(amount) : amount;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(decimal.toNumber());
}
