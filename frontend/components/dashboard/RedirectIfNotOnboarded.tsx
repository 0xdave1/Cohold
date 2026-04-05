'use client';

import { useEffect, type ReactNode } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useMe } from '@/lib/hooks/use-onboarding';
import { useOtpNotVerifiedRecovery } from '@/lib/hooks/use-otp-not-verified-session';
import { getApiErrorCode } from '@/lib/api/errors';

/**
 * If user is logged in but has not completed onboarding, redirect to onboarding.
 * Use in dashboard layout so incomplete users are sent to the onboarding flow.
 */
export function RedirectIfNotOnboarded({ children }: { children: ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const meQuery = useMe({ enabled: !!accessToken });
  const { data: profile, isLoading, isError, error } = meQuery;

  useOtpNotVerifiedRecovery(isError, error, !!accessToken && isError);

  useEffect(() => {
    if (!accessToken) return;
    if (isLoading || isError) return;
    if (profile && profile.onboardingCompletedAt == null) {
      router.replace('/onboarding/personal-details');
    }
  }, [accessToken, profile, isLoading, isError, router]);

  if (accessToken && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  if (accessToken && isError) {
    const code = axios.isAxiosError(error) ? getApiErrorCode(error) : undefined;
    if (code === 'OTP_NOT_VERIFIED') {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <p className="text-slate-400">Redirecting to email verification...</p>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-4 text-center">
        <p className="text-slate-400">We couldn&apos;t load your account. Please sign in again.</p>
        <button
          type="button"
          className="rounded-xl bg-cohold-blue px-4 py-2 text-sm font-semibold text-white"
          onClick={() => router.replace('/login')}
        >
          Back to login
        </button>
      </div>
    );
  }

  if (accessToken && !isLoading && profile && profile.onboardingCompletedAt == null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-400">Redirecting to onboarding...</p>
      </div>
    );
  }

  return <>{children}</>;
}
