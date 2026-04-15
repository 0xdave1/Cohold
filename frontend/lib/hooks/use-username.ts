import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthReady } from '@/lib/hooks/use-auth-ready';
import { useAuthStore } from '@/stores/auth.store';

export type UsernameAvailabilityResponse = {
  available: boolean;
  normalizedUsername: string;
  reason: 'USERNAME_REQUIRED' | 'USERNAME_INVALID' | 'USERNAME_RESERVED' | 'USERNAME_TAKEN' | null;
};

export function normalizeUsernameInput(input: string): string {
  return input.trim().replace(/^@+/, '').toLowerCase();
}

export function useUsernameAvailability(username: string) {
  const authReady = useAuthReady();
  const normalized = normalizeUsernameInput(username);

  return useQuery({
    queryKey: ['username-availability', normalized],
    enabled: authReady && normalized.length >= 1,
    queryFn: async () => {
      const res = await apiClient.get<UsernameAvailabilityResponse>(
        `/users/username-availability?username=${encodeURIComponent(normalized)}`,
      );
      if (!res.success) {
        throw new Error(res.error ?? 'Failed to check username');
      }
      return res.data;
    },
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useSetUsername() {
  const setSession = useAuthStore((s) => s.setSession);
  const session = useAuthStore((s) => ({
    accessToken: s.accessToken,
    refreshToken: s.refreshToken,
    role: s.role,
    user: s.user,
  }));

  return useMutation({
    mutationFn: async (username: string) => {
      const payload = { username: normalizeUsernameInput(username) };
      const res = await apiClient.patch<any>('/users/me/username', payload);
      if (!res.success) {
        throw new Error(res.error ?? 'Failed to set username');
      }
      return res.data;
    },
    onSuccess: (me) => {
      if (session.accessToken && session.role) {
        setSession({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          role: session.role,
          user: {
            ...(session.user ?? { id: me.id, email: me.email }),
            username: me.username,
            requiresUsernameSetup: me.requiresUsernameSetup ?? (me.username == null),
          },
        });
      }
    },
  });
}

