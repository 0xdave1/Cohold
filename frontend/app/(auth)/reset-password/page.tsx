'use client';

import { Suspense, useState, useCallback, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { getApiErrorMessage } from '@/lib/api/errors';
import { auth } from '@/components/auth/auth-styles';
import { AuthScreenHeader } from '@/components/auth/AuthScreenHeader';
import { KeyIcon } from '@/components/auth/AuthIcons';

export const dynamic = 'force-dynamic';

function parseOtpToCells(raw: string): string[] {
  const digits = raw.replace(/\D/g, '').slice(0, 6);
  const cells = ['', '', '', '', '', ''];
  for (let i = 0; i < digits.length; i++) {
    cells[i] = digits[i] ?? '';
  }
  return cells;
}

function Eye({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOff({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const otpFromUrl = searchParams.get('otp') ?? '';

  const [otp, setOtp] = useState<string[]>(() => parseOtpToCells(otpFromUrl));
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const { resetPassword } = useAuth();

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    setOtp(parseOtpToCells(otpFromUrl));
  }, [otpFromUrl]);

  const otpString = otp.join('');

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

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!email) {
      setError('Missing email. Please start from forgot password.');
      return;
    }
    if (otpString.length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }

    setError(null);

    try {
      const res = await resetPassword.mutateAsync({
        email,
        otp: otpString,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });

      if (!res.success) {
        setError(res.error ?? 'Unable to reset password. Please try again.');
        return;
      }
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Unable to reset password. Please try again.'));
    }
  };

  return (
    <main className={auth.card}>
      <AuthScreenHeader backHref="/forgot-password" backLabel="Back to forgot password" />
      <p className={auth.pageTitle}>Reset password</p>
      <div className="mt-2">
        <KeyIcon className="mb-3" />
        <h1 className={auth.heading}>Reset password</h1>
        <p className={'mt-2 ' + auth.body}>
          A 6-digit OTP has been sent to your email, enter code to recover account.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <div className="space-y-1.5">
          <label className={auth.label}>OTP Code</label>
          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
            {otp.slice(0, 3).map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                className={auth.otpCell}
              />
            ))}
            <span className="px-0.5 text-lg font-light text-cohold-muted" aria-hidden>
              –
            </span>
            {otp.slice(3, 6).map((digit, i) => {
              const index = i + 3;
              return (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className={auth.otpCell}
                />
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={auth.label}>New password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter password"
              className={auth.input + ' ' + auth.inputWithIcon}
              {...form.register('newPassword')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-cohold-muted hover:text-cohold-text"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {form.formState.errors.newPassword && <p className={auth.error}>{form.formState.errors.newPassword.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className={auth.label}>Confirm password</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Enter password"
              className={auth.input + ' ' + auth.inputWithIcon}
              {...form.register('confirmPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-cohold-muted hover:text-cohold-text"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {form.formState.errors.confirmPassword && (
            <p className={auth.error}>{form.formState.errors.confirmPassword.message}</p>
          )}
        </div>

        {error && <div className={auth.errorBox}>{error}</div>}

        <button type="submit" disabled={resetPassword.isPending} className={auth.btnPrimary}>
          {resetPassword.isPending ? 'Resetting...' : 'Complete'}
        </button>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className={auth.card}>
          <p className="text-sm text-cohold-muted">Loading...</p>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
