'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Redirects to login if user is not authenticated (no access token).
 * Use in onboarding layout so unauthenticated users cannot access onboarding steps.
 */
export function OnboardingGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (accessToken === null) {
      router.replace('/login?redirect=/onboarding/personal-details');
    }
  }, [accessToken, router]);

  if (accessToken === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-auth-bg">
        <p className="text-auth-body">Redirecting to login...</p>
      </div>
    );
  }

  return <>{children}</>;
}
