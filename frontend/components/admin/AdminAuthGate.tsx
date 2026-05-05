'use client';

import { type ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Ensures admin panel never renders the shell until an in-memory admin access token exists
 * (issued via HttpOnly refresh + `/admin-auth/refresh` during `AuthBootstrap`).
 */
export function AdminAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const authChecked = useAuthStore((s) => s.authChecked);
  const adminAccessToken = useAuthStore((s) => s.adminAccessToken);

  useEffect(() => {
    if (!authChecked) return;
    if (!adminAccessToken) {
      router.replace('/admin/login');
    }
  }, [authChecked, adminAccessToken, router]);

  if (!authChecked || !adminAccessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#f8f5f0' }}>
        <p className="text-sm text-gray-600">Loading session…</p>
      </div>
    );
  }

  return <>{children}</>;
}
