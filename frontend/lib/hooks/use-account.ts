import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'next/navigation';

export function useRequestDeleteAccountOtp() {
  return useMutation({
    mutationFn: async (email: string) => {
      const res = await apiClient.post<{ message?: string }>('/auth/request-otp', {
        email,
        purpose: 'delete_account',
      });
      if (!res.success) throw new Error(res.error ?? 'Failed to send OTP');
      return res.data;
    },
  });
}

export function useDeleteAccount() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clearSession = useAuthStore((s) => s.clearSession);

  return useMutation({
    mutationFn: async (payload: { email: string; otp: string }) => {
      const res = await apiClient.post<{ message: string }>('/users/me/delete', payload);
      if (!res.success) throw new Error(res.error ?? 'Failed to delete account');
      return res.data;
    },
    onSuccess: () => {
      queryClient.clear();
      clearSession();
      router.push('/login?deleted=1');
    },
  });
}
