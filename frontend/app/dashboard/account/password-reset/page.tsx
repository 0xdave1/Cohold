'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMe } from '@/lib/hooks/use-onboarding';
import { getApiErrorMessage } from '@/lib/api/errors';
import { Lock } from 'lucide-react';

const schema = z
  .object({
    email: z.string().email('Valid email required'),
    otp: z.string().length(6, 'Enter 6-digit OTP'),
    newPassword: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export default function PasswordResetPage() {
  const { data: me } = useMe();
  const { requestOtp, resetPassword } = useAuth();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: me?.email ?? '',
      otp: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const email = form.watch('email');

  const handleRequestOtp = async () => {
    setError(null);
    if (!email) {
      setError('Enter your email');
      return;
    }
    try {
      await requestOtp.mutateAsync({ email, purpose: 'login' });
      setStep('reset');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to send OTP'));
    }
  };

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await resetPassword.mutateAsync({
        email: values.email,
        otp: values.otp,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to reset password'));
    }
  };

  return (
    <div className="min-h-screen bg-dashboard-bg pb-20">
      <div className="space-y-6 px-4 pt-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/account"
            className="p-2 rounded-lg hover:bg-dashboard-border/50 text-dashboard-heading"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-semibold text-dashboard-heading">Password reset</h1>
        </div>
        <p className="text-sm text-dashboard-body">
          Request a code to your email and set a new password.
        </p>

        {step === 'request' ? (
          <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-6">
            <div className="mx-auto h-12 w-12 rounded-full bg-cohold-icon-bg flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-dashboard-heading" />
            </div>
            <label className="text-sm font-medium text-dashboard-heading block mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => form.setValue('email', e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-dashboard-border bg-white px-3 py-2.5 text-dashboard-heading placeholder:text-dashboard-muted mb-4"
            />
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <button
              type="button"
              onClick={handleRequestOtp}
              disabled={requestOtp.isPending}
              className="w-full rounded-xl bg-cohold-blue py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {requestOtp.isPending ? 'Sending...' : 'Send reset code'}
            </button>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-dashboard-heading block mb-1">Email</label>
              <input
                type="email"
                {...form.register('email')}
                className="w-full rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-dashboard-heading"
                readOnly
              />
            </div>
            <div>
              <label className="text-sm font-medium text-dashboard-heading block mb-1">OTP code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                {...form.register('otp')}
                className="w-full rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-dashboard-heading placeholder:text-dashboard-muted"
              />
              {form.formState.errors.otp && (
                <p className="text-xs text-red-600 mt-1">{form.formState.errors.otp.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-dashboard-heading block mb-1">New password</label>
              <input
                type="password"
                {...form.register('newPassword')}
                className="w-full rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-dashboard-heading"
              />
              {form.formState.errors.newPassword && (
                <p className="text-xs text-red-600 mt-1">{form.formState.errors.newPassword.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-dashboard-heading block mb-1">Confirm password</label>
              <input
                type="password"
                {...form.register('confirmPassword')}
                className="w-full rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-dashboard-heading"
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-xs text-red-600 mt-1">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={resetPassword.isPending}
              className="w-full rounded-xl bg-cohold-blue py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {resetPassword.isPending ? 'Resetting...' : 'Reset password'}
            </button>
            <button
              type="button"
              onClick={() => setStep('request')}
              className="w-full rounded-xl border border-dashboard-border py-3 text-sm font-medium text-dashboard-heading mt-2"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
