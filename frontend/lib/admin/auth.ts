import { apiClient } from '@/lib/api/client';

export async function adminLogin(email: string, password: string) {
  const res = await apiClient.post<{ accessToken?: string }>('/admin-auth/login', {
    email,
    password,
  });
  if (!res.success) {
    throw new Error(res.error ?? 'Invalid credentials');
  }
}

export async function adminLogout() {
  await apiClient.post('/admin-auth/logout', {});
}
