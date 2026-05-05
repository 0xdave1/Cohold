import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { clearAdminSiteSession, establishAdminSiteSession } from '@/lib/site-session';

export async function adminLogin(email: string, password: string) {
  useAuthStore.getState().clearUserSession();
  const res = await apiClient.post<{ accessToken?: string }>('/admin-auth/login', {
    email,
    password,
  });
  if (!res.success) {
    throw new Error(res.error ?? 'Invalid credentials');
  }
  const tok = useAuthStore.getState().adminAccessToken;
  if (tok) await establishAdminSiteSession(tok);
}

export async function adminLogout() {
  try {
    await apiClient.post('/admin-auth/logout', {});
  } finally {
    await clearAdminSiteSession();
    useAuthStore.getState().clearAdminSession();
  }
}
