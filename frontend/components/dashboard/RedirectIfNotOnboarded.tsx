'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useMe } from '@/lib/hooks/use-onboarding';

/**
 * If user is logged in but has not completed onboarding, redirect to onboarding.
 * Use in dashboard layout so incomplete users are sent to the onboarding flow.
 */
export function RedirectIfNotOnboarded({ children }: { children: ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const { data: profile, isLoading, isError } = useMe({ enabled: !!accessToken });

  useEffect(() => {
    if (!accessToken) return;
    if (isLoading || isError) return;
    if (profile && profile.onboardingCompletedAt == null) {
      router.replace('/onboarding/personal-details');
    }
  }, [accessToken, profile, isLoading, isError, router]);

  if (accessToken && !isLoading && profile && profile.onboardingCompletedAt == null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-400">Redirecting to onboarding...</p>
      </div>
    );
  }

  return <>{children}</>;
}
