import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthReady } from '@/lib/hooks/use-auth-ready';

export interface InvestmentProperty {
  id: string;
  title: string;
  description: string;
  location: string;
  totalValue: string;
  currency: string;
  sharesTotal: string;
  sharesSold: string;
  currentRaised: string;
  sharePrice?: string;
  /** Unitless annual rate from API, e.g. 0.125 = 12.5% */
  annualYield?: string | null;
}

export interface MyInvestment {
  id: string;
  userId: string;
  propertyId: string;
  amount: string;
  currency: string;
  shares: string;
  sharePrice?: string;
  /** Cumulative net ROI credited to wallet for this position (source of truth). */
  totalReturns?: string;
  /** Present on API responses; used for portfolio detail UI */
  ownershipPercent?: string;
  status: string;
  createdAt: string;
  property: InvestmentProperty;
}

export interface MyInvestmentsResponse {
  items: MyInvestment[];
  meta: { page: number; limit: number; total: number };
}

/** Fetches current user's investments (uses JWT). */
export function useMyInvestments(page = 1, limit = 20) {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ['investments', 'me', page, limit],
    queryFn: async () => {
      const res = await apiClient.get<MyInvestmentsResponse>('/investments', {
        page: String(page),
        limit: String(limit),
      });
      return res.success ? res.data : { items: [], meta: { page, limit, total: 0 } };
    },
    enabled: authReady,
    staleTime: 0,
    refetchOnMount: true,
  });
}

/** Single investment + property (for portfolio detail). */
export function useInvestmentById(id: string | undefined) {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ['investments', id],
    queryFn: async () => {
      const res = await apiClient.get<MyInvestment>(`/investments/${id}`);
      return res.success ? res.data : null;
    },
    enabled: !!id && authReady,
    staleTime: 0,
    refetchOnMount: true,
  });
}
