'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { auth } from '@/components/auth/auth-styles';
import { getApiErrorCode, getApiErrorMessage } from '@/lib/api/errors';
import { AuthScreenHeader } from '@/components/auth/AuthScreenHeader';
import { LockIcon } from '@/components/auth/AuthIcons';

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
        router.push(`/auth/verify-otp?email=${encodeURIComponent(values.email)}&purpose=signup`);
        return;
      }
      setError(getApiErrorMessage(e, 'Unable to send reset code. Please try again.'));
    }
  };

  return (
    <main className={auth.card}>
      <AuthScreenHeader backHref="/login" backLabel="Back to login" />
      <p className={auth.pageTitle}>Forgot password</p>
      <div className="mt-2">
        <LockIcon className="mb-3" />
        <h1 className={'mt-1 ' + auth.heading}>Forgot password</h1>
        <p className={'mt-2 ' + auth.body}>
          You don&apos;t have to worry, we can help you recover your account. Just provide the email you used during
          account creation.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <div className="space-y-1.5">
          <label className={auth.label}>Email address</label>
          <input type="email" placeholder="doe@mail.com" className={auth.input} {...form.register('email')} />
          {form.formState.errors.email && <p className={auth.error}>{form.formState.errors.email.message}</p>}
        </div>
        {error && <div className={auth.errorBox}>{error}</div>}
        <button type="submit" disabled={forgotPassword.isPending} className={auth.btnPrimary}>
          {forgotPassword.isPending ? 'Sending...' : 'Proceed'}
        </button>
      </form>
    </main>
  );
}
