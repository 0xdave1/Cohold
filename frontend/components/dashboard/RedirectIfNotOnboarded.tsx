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

  const { accessToken, hasHydrated } = useAuthStore((s) => ({
    accessToken: s.accessToken,
    hasHydrated: s.hasHydrated,
  }));

  const meQuery = useMe({
    enabled: hasHydrated && !!accessToken,
  });

  const { data: profile, isLoading, isError, error } = meQuery;

  useOtpNotVerifiedRecovery(isError, error, hasHydrated && !!accessToken && isError);

  // ✅ Redirects ONLY after hydration
  useEffect(() => {
    if (!hasHydrated) return;

    if (!accessToken) {
      router.replace('/login');
      return;
    }

    if (isLoading || isError) return;

    if (profile && profile.onboardingCompletedAt == null) {
      router.replace('/onboarding/personal-details');
      return;
    }

    // Username is now required for the product identity layer.
    // Legacy users with `username=null` must complete setup before using dashboard features.
    const usernameMissing = profile && !profile.username;
    const onUsernameSetup = pathname?.startsWith('/dashboard/username');
    if (profile && profile.onboardingCompletedAt != null && usernameMissing && !onUsernameSetup) {
      router.replace('/dashboard/username');
    }
  }, [hasHydrated, accessToken, profile, isLoading, isError, router, pathname]);

  // ✅ Block render until hydration completes
  if (!hasHydrated) {
    return null;
  }

  // ✅ Stable loading state
  if (accessToken && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  // ✅ Error handling AFTER hydration only
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

  // ✅ Prevent flicker during redirect
  if (
    accessToken &&
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