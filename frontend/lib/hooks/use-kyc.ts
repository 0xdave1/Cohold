import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { uploadKycDocument, type KycDocType } from '@/lib/uploads/upload-file';
import { useMe } from './use-onboarding';

/** KYC status from backend (User.kycStatus / KycVerification.status). */
export type KycStatus = 'PENDING' | 'VERIFIED' | 'FAILED' | 'REQUIRES_REVIEW' | null;

export interface KycStatusResponse {
  status: KycStatus;
}

const ME_QUERY_KEY = ['users', 'me'];

/**
 * Returns current user's KYC status (derived from /users/me via useMe).
 */
export function useKycStatus() {
  const meQuery = useMe();
  return {
    ...meQuery,
    data: meQuery.data
      ? ({ status: (meQuery.data.kycStatus as KycStatus) ?? null } as KycStatusResponse)
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
      queryClient.invalidateQueries({ queryKey: [...ME_QUERY_KEY, 'kyc'] });
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
      queryClient.invalidateQueries({ queryKey: [...ME_QUERY_KEY, 'kyc'] });
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
      queryClient.invalidateQueries({ queryKey: [...ME_QUERY_KEY, 'kyc'] });
    },
  });
}

export type { KycDocType };
