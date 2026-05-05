import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminLogin, adminLogout } from '@/lib/admin/auth';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth.store';

vi.mock('@/lib/site-session', () => ({
  establishAdminSiteSession: vi.fn().mockResolvedValue(true),
  clearAdminSiteSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

describe('admin auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearSession();
  });

  it('login calls backend /admin-auth/login (not deprecated Next proxy)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ success: true, data: {} });
    await adminLogin('a@b.co', 'pw');
    expect(apiClient.post).toHaveBeenCalledWith('/admin-auth/login', { email: 'a@b.co', password: 'pw' });
    expect(apiClient.post).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/auth'),
      expect.anything(),
    );
  });

  it('logout calls /admin-auth/logout and clears admin token', async () => {
    useAuthStore.getState().setAdminAccessToken('adm');
    vi.mocked(apiClient.post).mockResolvedValue({ success: true, data: {} });
    await adminLogout();
    expect(apiClient.post).toHaveBeenCalledWith('/admin-auth/logout', {});
    expect(useAuthStore.getState().adminAccessToken).toBeNull();
  });
});
