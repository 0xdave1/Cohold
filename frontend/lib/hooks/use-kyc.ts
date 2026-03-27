import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useMe } from './use-onboarding';

/** KYC status from backend (User.kycStatus / KycVerification.status). */
export type KycStatus = 'PENDING' | 'VERIFIED' | 'FAILED' | 'REQUIRES_REVIEW' | null;

export interface KycStatusResponse {
  status: KycStatus;
}

const ME_QUERY_KEY = ['users', 'me'];

/**
 * Returns current user's KYC status (derived from /users/me via useMe).
 * Invalidating ME_QUERY_KEY after BVN submit or document upload refreshes this.
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

/**
 * Submits BVN for KYC. Invalidates user/me and KYC status on success.
 */
export function useSubmitBvn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bvn: string): Promise<SubmitBvnResponse> => {
      const res = await apiClient.post<SubmitBvnResponse>('/kyc/bvn', { bvn });
      if (!res.success) throw new Error(res.error ?? 'Failed to submit BVN');
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
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: [...ME_QUERY_KEY, 'kyc'] });
    },
  });
}

export type KycDocumentType = 'id-front' | 'id-back' | 'selfie';

export interface UploadKycDocumentResponse {
  documentKey: string;
}

/**
 * Uploads a KYC document (ID front/back or selfie).
 * Uses multipart/form-data with field names: file, documentType.
 */
export function useUploadKycDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      documentType: KycDocumentType;
      file: File;
    }): Promise<{ success: boolean; data: UploadKycDocumentResponse }> => {
      const formData = new FormData();
      formData.append('file', payload.file);
      formData.append('documentType', payload.documentType);

      const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
      const token = useAuthStore.getState().accessToken;

      const res = await fetch(`${baseURL}/kyc/upload-document`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? json?.message ?? 'Upload failed');
      }
      if (!json.success || !json.data?.documentKey) {
        throw new Error(json?.error ?? 'Upload failed');
      }
      return {
        success: json.success,
        data: { documentKey: json.data.documentKey },
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: [...ME_QUERY_KEY, 'kyc'] });
    },
  });
}
