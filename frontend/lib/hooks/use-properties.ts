import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthReady } from '@/lib/hooks/use-auth-ready';

export interface Property {
  id: string;
  title: string;
  description: string;
  location: string;
  totalValue: string;
  currency: 'NGN' | 'USD' | 'GBP' | 'EUR';
  fundingGoal?: string;
  fundedAmount?: string;
  minInvestment?: string;
  currentRaised?: string;
  sharesTotal?: string;
  sharesSold?: string;
  sharePrice?: string;
  /** When backend adds investment term metadata */
  duration?: string | null;
  annualYield?: string | null;
  status: string;
  createdAt: string;
  coverImageUrl?: string | null;
}

export interface PropertyDocument {
  id: string;
  type: string;
  url: string;
}

export interface PropertyImage {
  id: string;
  url: string;
  altText?: string | null;
  position: number;
}

export interface PropertyDetails extends Property {
  investments?: Array<{ userId: string; amount: string }>;
  images?: PropertyImage[];
  documents?: PropertyDocument[];
  fundingProgressPercent?: string;
  /** Unitless rate from API, e.g. 0.125 = 12.5% p.a. */
  annualYield?: string | null;
  /** Optional human-readable term — add to API when available */
  duration?: string | null;
}

export function useProperties(page = 1, limit = 20) {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ['properties', page, limit],
    queryFn: async () => {
      const res = await apiClient.get<{
        items: Property[];
        meta: { page: number; limit: number; total: number };
      }>('/properties', { page, limit });
      return res.success ? res.data : { items: [], meta: { page, limit, total: 0 } };
    },
    enabled: authReady,
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: ['properties', id],
    queryFn: async () => {
      const res = await apiClient.get<Property>(`/properties/${id}`);
      return res.success ? res.data : null;
    },
    enabled: !!id,
  });
}

export function usePropertyDetails(id: string) {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ['properties', id, 'details'],
    queryFn: async () => {
      const res = await apiClient.get<PropertyDetails>(`/properties/${id}/details`);
      return res.success ? res.data : null;
    },
    enabled: !!id && authReady,
    staleTime: 0,
  });
}

/** Invalidate + refetch so wallet / portfolio update immediately after buy or sell. */
export async function invalidateInvestmentRelatedQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['investments'] }),
    queryClient.invalidateQueries({ queryKey: ['properties'] }),
    queryClient.invalidateQueries({ queryKey: ['wallets'] }),
    queryClient.invalidateQueries({ queryKey: ['wallets', 'transactions'] }),
  ]);
  await Promise.all([
    queryClient.refetchQueries({ queryKey: ['wallets', 'balances'] }),
    queryClient.refetchQueries({ queryKey: ['investments'] }),
    queryClient.refetchQueries({ queryKey: ['properties'] }),
  ]);
}

export function useCreateInvestment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      propertyId: string;
      shares: string;
      clientReference: string;
    }) => {
      const res = await apiClient.post<unknown>('/investments/fractional', data);
      if (!res.success) {
        throw new Error(res.error ?? 'Investment could not be completed');
      }
      return res.data;
    },
    onSuccess: async () => {
      await invalidateInvestmentRelatedQueries(queryClient);
    },
  });
}

/** Atomic sell — profit-only platform fee (backend). */
export function useSellFractional() {
  return useMutation({
    mutationFn: async (body: { propertyId: string; sharesToSell: string; clientReference?: string }) => {
      const res = await apiClient.post<{
        sellAmount: string;
        fee: string;
        netToUser: string;
        costBasis: string;
        walletBalanceAfter: string;
      }>('/investments/fractional/sell', body);
      if (!res.success) {
        throw new Error(res.error ?? 'Sell could not be completed');
      }
      return res.data;
    },
  });
}
