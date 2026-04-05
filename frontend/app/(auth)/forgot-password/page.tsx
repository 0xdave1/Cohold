'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';
import { auth } from '@/components/auth/auth-styles';
import { getApiErrorCode, getApiErrorMessage } from '@/lib/api/errors';

const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { forgotPassword } = useAuth();

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setError(null);
    try {
      const res = await forgotPassword.mutateAsync({ email: values.email });
      if (!res.success) {
        setError(res.error ?? 'Unable to send reset code. Please try again.');
        return;
      }
      router.push(`/reset-password?email=${encodeURIComponent(values.email)}`);
    } catch (e: unknown) {
      if (getApiErrorCode(e) === 'OTP_NOT_VERIFIED') {
        router.push(
          `/auth/verify-otp?email=${encodeURIComponent(values.email)}&purpose=signup`,
        );
        return;
      }
      setError(getApiErrorMessage(e, 'Unable to send reset code. Please try again.'));
    }
  };

  return (
    <main className={auth.card}>
      <p className={auth.pageTitle}>forgot password</p>
      <div className="mt-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cohold-icon-bg">
          <svg className="h-7 w-7 text-auth-heading" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className={"mt-4 " + auth.heading}>Forgot password</h1>
        <p className={"mt-2 " + auth.body}>
          You don&apos;t have to worry, we can help you recover your account. Just provide the email you used during account creation.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        <div className="space-y-1.5">
          <label className={auth.label}>Email address</label>
          <input
            type="email"
            placeholder="doe@mail.com"
            className={auth.input}
            {...form.register('email')}
          />
          {form.formState.errors.email && <p className={auth.error}>{form.formState.errors.email.message}</p>}
        </div>
        {error && <div className={auth.errorBox}>{error}</div>}
        <button type="submit" disabled={forgotPassword.isPending} className={auth.btnPrimary}>
          {forgotPassword.isPending ? 'Sending...' : 'Proceed'}
        </button>
      </form>
      <p className={'mt-6 ' + auth.footerText}>
        <Link href="/login" className={auth.link}>Back to login</Link>
      </p>
    </main>
  );
}
