'use client';

import { useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { getApiErrorCode } from '@/lib/api/errors';

/**
 * When /users/me fails with OTP_NOT_VERIFIED (stale session or policy mismatch),
 * clear the client session and send the user to signup OTP verification.
 */
export function useOtpNotVerifiedRecovery(
  isError: boolean,
  error: unknown,
  enabled: boolean,
): void {
  const router = useRouter();
  const clearSession = useAuthStore((s) => s.clearSession);

  useEffect(() => {
    if (!enabled || !isError) return;
    if (!axios.isAxiosError(error)) return;
    if (getApiErrorCode(error) !== 'OTP_NOT_VERIFIED') return;
    const email = useAuthStore.getState().user?.email ?? '';
    clearSession();
    router.replace(`/auth/verify-otp?email=${encodeURIComponent(email)}&purpose=signup`);
  }, [enabled, isError, error, clearSession, router]);
}
