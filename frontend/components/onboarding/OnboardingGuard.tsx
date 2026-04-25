'use client';

import { useEffect, type ReactNode } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useMe } from '@/lib/hooks/use-onboarding';
import { useOtpNotVerifiedRecovery } from '@/lib/hooks/use-otp-not-verified-session';
import { getApiErrorCode } from '@/lib/api/errors';

/**
 * Requires cookie session + verified /users/me profile.
 * Unauthenticated users go to login; stale unverified sessions go to signup OTP verification.
 */
export function OnboardingGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const authChecked = useAuthStore((s) => s.authChecked);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const meQuery = useMe({ enabled: authChecked && isAuthenticated });

  useOtpNotVerifiedRecovery(meQuery.isError, meQuery.error, isAuthenticated && meQuery.isError);

  useEffect(() => {
    if (!authChecked) return;
    if (!isAuthenticated) {
      router.replace('/login?redirect=/onboarding/personal-details');
    }
  }, [isAuthenticated, authChecked, router]);

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-auth-bg">
        <p className="text-auth-body">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-auth-bg">
        <p className="text-auth-body">Redirecting to login...</p>
      </div>
    );
  }

  if (meQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-auth-bg">
        <p className="text-auth-body">Loading...</p>
      </div>
    );
  }

  if (meQuery.isError) {
    const code = axios.isAxiosError(meQuery.error) ? getApiErrorCode(meQuery.error) : undefined;
    if (code === 'OTP_NOT_VERIFIED') {
      return (
        <div className="flex min-h-screen items-center justify-center bg-auth-bg">
          <p className="text-auth-body">Redirecting to email verification...</p>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-auth-bg px-4 text-center">
        <p className="text-auth-body">We couldn&apos;t load your account. Please sign in again.</p>
        <button
          type="button"
          className="rounded-xl bg-cohold-blue px-4 py-2 text-sm font-semibold text-white"
          onClick={() => router.replace('/login?redirect=/onboarding/personal-details')}
        >
          Back to login
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
