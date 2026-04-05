'use client';

import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { getApiErrorMessage } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

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

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const otpFromUrl = searchParams.get('otp') ?? '';

  const [otp, setOtp] = useState(otpFromUrl);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { resetPassword } = useAuth();

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!email) {
      setError('Missing email. Please start from forgot password.');
      return;
    }
    if (otp.length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }

    setError(null);

    try {
      const res = await resetPassword.mutateAsync({
        email,
        otp,
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
    <main className="rounded-auth-radius-lg bg-auth-card p-8 shadow-[var(--auth-shadow-card)]">
      <p className="text-sm font-medium uppercase tracking-wide text-auth-body">reset password</p>
      <div className="mt-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-cohold-icon-bg">
          <svg className="h-7 w-7 text-auth-heading" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h1 className="mt-4 text-[22px] font-bold leading-tight text-auth-heading">Reset password</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-auth-body">
          A 6-digit OTP has been sent to your email, enter code to recover account.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-auth-heading">6-digit code</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            className="w-full rounded-[10px] border border-[hsl(var(--auth-input-border))] bg-white px-3 py-2.5 text-[15px] text-auth-heading placeholder:text-auth-body outline-none focus:border-cohold-blue focus:ring-1 focus:ring-cohold-blue"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-auth-heading">New password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter password"
              className="w-full rounded-[10px] border border-[hsl(var(--auth-input-border))] bg-white px-3 py-2.5 pr-10 text-[15px] text-auth-heading placeholder:text-auth-body outline-none focus:border-cohold-blue focus:ring-1 focus:ring-cohold-blue"
              {...form.register('newPassword')}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-auth-body hover:text-auth-heading" aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {form.formState.errors.newPassword && <p className="text-xs text-red-600">{form.formState.errors.newPassword.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-auth-heading">Confirm password</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Enter password"
              className="w-full rounded-[10px] border border-[hsl(var(--auth-input-border))] bg-white px-3 py-2.5 pr-10 text-[15px] text-auth-heading placeholder:text-auth-body outline-none focus:border-cohold-blue focus:ring-1 focus:ring-cohold-blue"
              {...form.register('confirmPassword')}
            />
            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-auth-body hover:text-auth-heading" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {form.formState.errors.confirmPassword && <p className="text-xs text-red-600">{form.formState.errors.confirmPassword.message}</p>}
        </div>

        {error && <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

        <button type="submit" disabled={resetPassword.isPending} className="w-full rounded-xl bg-cohold-blue py-3 text-[15px] font-semibold text-white shadow-[var(--auth-shadow)] hover:bg-[hsl(var(--cohold-blue-hover))] disabled:cursor-not-allowed disabled:opacity-60">
          {resetPassword.isPending ? 'Resetting...' : 'Complete'}
        </button>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}