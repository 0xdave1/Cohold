import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/admin/api';

export const ADMIN_KYC_QUERY_KEYS = {
  verifications: ['admin', 'verifications'] as const,
  users: ['admin', 'users'] as const,
  user: (id: string) => ['admin', 'user', id] as const,
  dashboard: ['admin', 'dashboard'] as const,
};

export function invalidateAdminKycQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ADMIN_KYC_QUERY_KEYS.verifications });
  void queryClient.invalidateQueries({ queryKey: ADMIN_KYC_QUERY_KEYS.users });
  void queryClient.invalidateQueries({ queryKey: ADMIN_KYC_QUERY_KEYS.dashboard });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'user'] });
}

export function useAdminApproveKyc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (verificationId: string) => adminApi.approveKyc(verificationId),
    onSuccess: () => invalidateAdminKycQueries(queryClient),
  });
}

export function useAdminRejectKyc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { verificationId: string; failureReason: string }) =>
      adminApi.rejectKyc(payload.verificationId, { failureReason: payload.failureReason }),
    onSuccess: () => invalidateAdminKycQueries(queryClient),
  });
}
