'use client';

import { Suspense, useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';
import { getApiErrorMessage } from '@/lib/api/errors';
import { EnvelopeIcon } from '@/components/auth/AuthIcons';
import { auth } from '@/components/auth/auth-styles';
import { AuthScreenHeader } from '@/components/auth/AuthScreenHeader';

export const dynamic = 'force-dynamic';

function VerifyOtpContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get('email') ?? '';
  const purpose = (searchParams.get('purpose') as 'signup' | 'login' | 'transaction') ?? 'signup';
  const reason = searchParams.get('reason') ?? '';

  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const { completeSignup, verifyOtp, resendOtp } = useAuth();

  useEffect(() => {
    if (purpose === 'login' && email) {
      router.replace(`/reset-password?email=${encodeURIComponent(email)}`);
    }
  }, [purpose, email, router]);

  const otpString = otp.join('');
  const isPending = completeSignup.isPending || verifyOtp.isPending || resendOtp.isPending;

  const handleChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value)) return;

      const digit = value.slice(-1);
      const next = [...otp];
      next[index] = digit;
      setOtp(next);
      setError(null);

      if (digit && index < otp.length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [otp],
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        if (otp[index]) {
          const next = [...otp];
          next[index] = '';
          setOtp(next);
          return;
        }

        if (index > 0) {
          const next = [...otp];
          next[index - 1] = '';
          setOtp(next);
          inputRefs.current[index - 1]?.focus();
        }
      }

      if (e.key === 'ArrowLeft' && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }

      if (e.key === 'ArrowRight' && index < otp.length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [otp],
  );

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();

    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = ['', '', '', '', '', ''];
    pasted.split('').forEach((char, i) => {
      next[i] = char;
    });

    setOtp(next);
    setError(null);

    const nextFocusIndex = pasted.length >= 6 ? 5 : pasted.length;
    inputRefs.current[nextFocusIndex]?.focus();
  }, []);

  const handleSubmit = async () => {
    if (otpString.length !== 6) {
      setError('Enter all 6 digits');
      return;
    }

    if (!email) {
      setError('Missing email. Please start signup again.');
      return;
    }

    setError(null);

    try {
      if (purpose === 'signup') {
        const res = await completeSignup.mutateAsync({ email, otp: otpString });

        if (res.success) return;

        setError(res.error ?? 'Verification failed');
      } else {
        await verifyOtp.mutateAsync({ email, otp: otpString, purpose });
        router.push('/dashboard');
      }
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Invalid or expired code. Please try again.'));
    }
  };

  const handleResendOtp = async () => {
    if (!email) {
      setError('Missing email. Please go back and try again.');
      return;
    }
    setError(null);
    try {
      const res = await resendOtp.mutateAsync({ email, purpose });
      if (!res.success) {
        throw new Error(res.error ?? 'Failed to resend OTP');
      }
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Unable to resend OTP right now. Please try again.'));
    }
  };

  const backHref = purpose === 'signup' ? '/signup' : '/login';

  if (purpose === 'login' && email) {
    return (
      <main className={auth.card}>
        <p className={auth.body}>Redirecting to password reset…</p>
      </main>
    );
  }

  return (
    <main className={auth.card}>
      <AuthScreenHeader backHref={backHref} backLabel={purpose === 'signup' ? 'Back to create account' : 'Back to login'} />
      <p className={auth.pageTitle}>Verify account</p>

      <div className="mt-2">
        <EnvelopeIcon className="mb-3" />
        <h1 className={auth.heading}>Verify your account</h1>
        <p className={`mt-2 ${auth.body}`}>
          A 6-digit OTP has been sent to your email. Enter OTP to verify your account and continue
        </p>
        {reason === 'pending' && (
          <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50 p-3 text-sm text-amber-950">
            Account pending verification. Enter your OTP to continue, or request a new code.
          </div>
        )}
      </div>

      <div className="mt-6 space-y-5">
        <div className="flex items-center justify-center gap-1.5 sm:gap-2">
          {otp.slice(0, 3).map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              className={auth.otpCell}
            />
          ))}
          <span className="px-0.5 text-lg font-light text-cohold-muted" aria-hidden>
            –
          </span>
          {otp.slice(3, 6).map((digit, index) => {
            const i = index + 3;
            return (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                className={auth.otpCell}
              />
            );
          })}
        </div>

        {error && <div className={auth.errorBox}>{error}</div>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={otpString.length !== 6 || isPending}
          className={auth.btnPrimary}
        >
          {isPending ? 'Verifying...' : 'Verify & continue'}
        </button>
      </div>

      <p className={`mt-5 ${auth.footerText}`}>
        Didn&apos;t receive the code?{' '}
        <button
          type="button"
          onClick={handleResendOtp}
          disabled={resendOtp.isPending}
          className={auth.link}
        >
          {resendOtp.isPending ? 'Resending...' : 'Resend OTP'}
        </button>{' '}
        <span className="text-cohold-muted/70">|</span>{' '}
        <Link href="/signup" className={auth.link}>
          Change email
        </Link>
      </p>
    </main>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className={auth.card}>
          <p className="text-sm text-cohold-muted">Loading...</p>
        </div>
      }
    >
      <VerifyOtpContent />
    </Suspense>
  );
}
