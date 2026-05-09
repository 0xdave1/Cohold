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
  id?: string;
  status:
    | 'PENDING'
    | 'ACTIVE'
    | 'FAILED'
    | 'SUSPENDED'
    | 'CLOSED'
    | 'REQUIRES_RETRY'
    | 'UNAVAILABLE'
    | 'UNKNOWN';
  accountNumber: string | null;
  bankName: string | null;
  currency: string | null;
  accountName: string | null;
  bankCode?: string | null;
  message?: string | null;
  retryCount?: number | null;
  provisionedAt?: string | null;
  updatedAt?: string | null;
}

function normalizeVirtualAccount(raw: unknown): VirtualAccount {
  const row = (raw ?? {}) as Record<string, unknown>;
  const status = String(row.status ?? 'UNKNOWN').toUpperCase();
  const allowed = new Set([
    'PENDING',
    'ACTIVE',
    'FAILED',
    'SUSPENDED',
    'CLOSED',
    'REQUIRES_RETRY',
    'UNAVAILABLE',
    'UNKNOWN',
  ]);
  return {
    id: typeof row.id === 'string' ? row.id : undefined,
    status: (allowed.has(status) ? status : 'UNKNOWN') as VirtualAccount['status'],
    accountNumber: typeof row.accountNumber === 'string' ? row.accountNumber : null,
    bankName: typeof row.bankName === 'string' ? row.bankName : null,
    currency: typeof row.currency === 'string' ? row.currency : null,
    accountName: typeof row.accountName === 'string' ? row.accountName : null,
    bankCode: typeof row.bankCode === 'string' ? row.bankCode : null,
    message: typeof row.message === 'string' ? row.message : null,
    retryCount: typeof row.retryCount === 'number' ? row.retryCount : null,
    provisionedAt: typeof row.provisionedAt === 'string' ? row.provisionedAt : null,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : null,
  };
}

export function useMyVirtualAccount() {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ['wallets', 'virtual-account'],
    queryFn: async () => {
      const res = await apiClient.get<unknown>('/virtual-accounts/me');
      if (!res.success) {
        return normalizeVirtualAccount({ status: 'UNKNOWN', message: res.error ?? 'Could not load account.' });
      }
      return normalizeVirtualAccount(res.data);
    },
    enabled: authReady,
    staleTime: 60000,
  });
}

export function useVirtualAccounts() {
  const meVa = useMyVirtualAccount();
  return {
    ...meVa,
    data: meVa.data ? [meVa.data] : [],
  };
}

export function useRetryVirtualAccountProvisioning() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<VirtualAccount>('/virtual-accounts/me/retry');
      if (!res.success) throw new Error(res.error ?? 'Could not retry virtual account provisioning.');
      return normalizeVirtualAccount(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets', 'virtual-account'] });
      queryClient.invalidateQueries({ queryKey: ['wallets', 'virtual-accounts'] });
    },
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
