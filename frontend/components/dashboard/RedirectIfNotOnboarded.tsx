'use client';

import { useEffect, type ReactNode } from 'react';
import axios from 'axios';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useMe } from '@/lib/hooks/use-onboarding';
import { useOtpNotVerifiedRecovery } from '@/lib/hooks/use-otp-not-verified-session';
import { getApiErrorCode } from '@/lib/api/errors';

export function RedirectIfNotOnboarded({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const { isAuthenticated, authChecked } = useAuthStore((s) => ({
    isAuthenticated: s.isAuthenticated,
    authChecked: s.authChecked,
  }));

  const meQuery = useMe({
    enabled: authChecked && isAuthenticated,
  });

  const { data: profile, isLoading, isError, error } = meQuery;

  useOtpNotVerifiedRecovery(isError, error, authChecked && isAuthenticated && isError);

  useEffect(() => {
    if (!authChecked) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (isLoading || isError) return;

    if (profile && profile.onboardingCompletedAt == null) {
      router.replace('/onboarding/personal-details');
      return;
    }

    const usernameMissing = profile && !profile.username;
    const onUsernameSetup = pathname?.startsWith('/dashboard/username');
    if (profile && profile.onboardingCompletedAt != null && usernameMissing && !onUsernameSetup) {
      router.replace('/dashboard/username');
    }
  }, [authChecked, isAuthenticated, profile, isLoading, isError, router, pathname]);

  if (!authChecked) {
    return null;
  }

  if (isAuthenticated && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  if (isAuthenticated && isError) {
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
        <p className="text-slate-400">
          We couldn&apos;t load your account. Please sign in again.
        </p>
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

  if (
    isAuthenticated &&
    !isLoading &&
    profile &&
    (profile.onboardingCompletedAt == null ||
      (profile.onboardingCompletedAt != null &&
        !profile.username &&
        !pathname?.startsWith('/dashboard/username')))
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-400">Redirecting...</p>
      </div>
    );
  }

  return <>{children}</>;
}
