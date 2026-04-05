'use client';

import { Suspense, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';
import { getApiErrorMessage } from '@/lib/api/errors';
import { EnvelopeIcon } from '@/components/auth/AuthIcons';
import { auth } from '@/components/auth/auth-styles';

export const dynamic = 'force-dynamic';

function VerifyOtpContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get('email') ?? '';
  const purpose = (searchParams.get('purpose') as 'signup' | 'login' | 'transaction') ?? 'signup';

  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const { completeSignup, verifyOtp } = useAuth();

  const otpString = otp.join('');
  const isPending = completeSignup.isPending || verifyOtp.isPending;

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
        await verifyOtp.mutateAsync({ email, otp: otpString });
        router.push('/dashboard');
      }
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Invalid or expired code. Please try again.'));
    }
  };

  return (
    <main className={auth.card}>
      <p className={auth.pageTitle}>verify account</p>

      <div className="mt-6">
        <EnvelopeIcon className="mb-4" />
        <h1 className={auth.heading}>Verify your account</h1>
        <p className={`mt-2 ${auth.body}`}>
          A 6-digit OTP has been sent to your email. Enter OTP to verify your account and continue
        </p>
      </div>

      <div className="mt-8 space-y-6">
        <div className="flex justify-center gap-2">
          {otp.map((digit, index) => (
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
              className="h-12 w-11 rounded-[10px] border border-[hsl(var(--auth-input-border))] bg-white text-center text-lg font-semibold text-auth-heading focus:border-cohold-blue focus:outline-none focus:ring-1 focus:ring-cohold-blue"
            />
          ))}
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

      <p className={`mt-6 ${auth.footerText}`}>
        Didn&apos;t receive the code?{' '}
        <Link href="/login" className={auth.link}>
          Back to login
        </Link>
      </p>
    </main>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <VerifyOtpContent />
    </Suspense>
  );
}