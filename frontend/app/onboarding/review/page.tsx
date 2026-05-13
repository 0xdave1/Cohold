'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { PencilIcon } from '@/components/auth/AuthIcons';
import { auth } from '@/components/auth/auth-styles';
import { getProfileInitials, useMe, useOnboarding } from '@/lib/hooks/use-onboarding';
import { AvatarUploader } from '@/components/upload/AvatarUploader';

export default function ReviewPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { data: profile, isLoading: profileLoading } = useMe();
  const { completeOnboarding } = useOnboarding();

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || '—';
  const phone = [profile?.phoneCountryCode, profile?.phoneNumber].filter(Boolean).join(' ').trim() || '—';
  const address = [profile?.houseNumber, profile?.streetName, profile?.city, profile?.state].filter(Boolean).join(', ') || '—';
  const avatarInitials = getProfileInitials(profile?.firstName, profile?.lastName);

  const handleConfirm = async () => {
    setError(null);
    try {
      await completeOnboarding.mutateAsync();
      router.push('/onboarding/success');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to complete. Please try again.');
    }
  };

  if (profileLoading) {
    return (
      <div className={auth.card}>
        <p className="text-sm text-cohold-muted">Loading...</p>
      </div>
    );
  }

  return (
    <main className={auth.card}>
      <p className={auth.pageTitle}>Review details</p>
      <div className="mt-1">
        <PencilIcon className="mb-3" />
        <h1 className={auth.heading}>Review details</h1>
        <p className={'mt-2 ' + auth.body}>Go through all the details you provided and ensure they are all accurate</p>
      </div>

      <div className="mt-6 flex flex-col items-center">
        <AvatarUploader variant="auth" initials={avatarInitials} photoUrl={profile?.profilePhotoUrl} />
      </div>

      <div className="mt-5 space-y-3 rounded-xl border border-cohold-border bg-white p-4">
        <div className="flex justify-between gap-4">
          <span className="text-sm text-cohold-muted">Full name</span>
          <span className="text-right text-sm font-semibold text-cohold-text">{fullName}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-sm text-cohold-muted">Phone number</span>
          <span className="text-right text-sm font-semibold text-cohold-text">{phone}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-sm text-cohold-muted">Nationality</span>
          <span className="text-right text-sm font-semibold text-cohold-text">{profile?.nationality ?? '—'}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-sm text-cohold-muted">Address</span>
          <span className="text-right text-sm font-semibold text-cohold-text">{address}</span>
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-cohold-muted">
        By tapping on Confirm and continue, you agree to Cohold{' '}
        <Link href="/terms" className={auth.link}>
          Terms and Conditions
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className={auth.link}>
          Privacy Policy
        </Link>
        .
      </p>

      {error && <div className={'mt-4 ' + auth.errorBox}>{error}</div>}
      <button type="button" onClick={handleConfirm} disabled={completeOnboarding.isPending} className={'mt-5 ' + auth.btnPrimary}>
        {completeOnboarding.isPending ? 'Completing...' : 'Confirm and continue'}
      </button>
    </main>
  );
}
