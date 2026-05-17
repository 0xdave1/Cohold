import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { uploadKycDocument, type KycDocType } from '@/lib/uploads/upload-file';
import { useMe } from './use-onboarding';
import { normalizeKycStatus, type KycStatusNormalized } from '@/lib/kyc/status';
import { useAuthStore } from '@/stores/auth.store';

/** KYC status from backend (User.kycStatus / KycVerification.status). */
export type KycStatus = KycStatusNormalized;

export interface KycStatusResponse {
  status: KycStatus;
}

const ME_QUERY_KEY = ['users', 'me'];
const KYC_ME_QUERY_KEY = [...ME_QUERY_KEY, 'kyc'] as const;

export interface KycMeResponse {
  kycStatus: string;
  onboardingCompletedAt?: string | null;
  verification?: { status: string } | null;
}

/**
 * Canonical KYC snapshot from GET /kyc/me (reconciles User.kycStatus with verification record).
 */
export function useKycMe() {
  const authChecked = useAuthStore((s) => s.authChecked);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: KYC_ME_QUERY_KEY,
    queryFn: async () => {
      const res = await apiClient.get<KycMeResponse>('/kyc/me');
      if (!res.success) throw new Error(res.error ?? 'Failed to fetch KYC status');
      if (res.data == null) throw new Error('Invalid response from server');
      return res.data;
    },
    enabled: authChecked && isAuthenticated,
    refetchOnWindowFocus: true,
  });
}

/**
 * Returns current user's KYC status (canonical User.kycStatus from /kyc/me, falling back to /users/me).
 */
export function useKycStatus() {
  const meQuery = useMe();
  const kycMeQuery = useKycMe();
  const canonicalStatus = kycMeQuery.data?.kycStatus ?? meQuery.data?.kycStatus;
  const isLoading = meQuery.isLoading || kycMeQuery.isLoading;
  const isError = meQuery.isError || kycMeQuery.isError;
  const error = kycMeQuery.error ?? meQuery.error;

  return {
    ...meQuery,
    isLoading,
    isError,
    error,
    data: canonicalStatus
      ? ({ status: normalizeKycStatus(canonicalStatus) } as KycStatusResponse)
      : undefined,
  };
}

export interface SubmitBvnResponse {
  status: string;
}

export function useSubmitBvn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bvn: string): Promise<SubmitBvnResponse> => {
      const res = await apiClient.post<SubmitBvnResponse>('/kyc/bvn', { bvn });
      if (!res.success) throw new Error(res.error ?? 'Failed to submit BVN');
      if (res.data == null) throw new Error('Invalid response from server');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: KYC_ME_QUERY_KEY });
    },
  });
}

export function useSubmitNin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (nin: string): Promise<SubmitBvnResponse> => {
      const res = await apiClient.post<SubmitBvnResponse>('/kyc/nin', { nin });
      if (!res.success) throw new Error(res.error ?? 'Failed to submit NIN');
      if (res.data == null) throw new Error('Invalid response from server');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: KYC_ME_QUERY_KEY });
    },
  });
}

/**
 * Presigned R2 upload for ID front / back / selfie (`/kyc/uploads/presign` + `complete`).
 */
export function useKycDocumentUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { docType: KycDocType; file: File }) => {
      return uploadKycDocument(payload.file, payload.docType);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: KYC_ME_QUERY_KEY });
    },
  });
}

export type { KycDocType };
