'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { PencilIcon } from '@/components/auth/AuthIcons';
import { auth } from '@/components/auth/auth-styles';
import { useMe, useOnboarding } from '@/lib/hooks/use-onboarding';
import { AvatarUploader } from '@/components/upload/AvatarUploader';

export default function ReviewPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { data: profile, isLoading: profileLoading } = useMe();
  const { completeOnboarding } = useOnboarding();

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || '—';
  const phone = [profile?.phoneCountryCode, profile?.phoneNumber].filter(Boolean).join(' ').trim() || '—';
  const address = [profile?.houseNumber, profile?.streetName, profile?.city, profile?.state].filter(Boolean).join(', ') || '—';
  const avatarInitials =
    [profile?.firstName?.[0], profile?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'U';

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
        <p className="text-auth-body">Loading...</p>
      </div>
    );
  }

  return (
    <main className={auth.card}>
      <p className={auth.pageTitle}>review</p>
      <div className="mt-6">
        <PencilIcon className="mb-4" />
        <h1 className={auth.heading}>Review details</h1>
        <p className={"mt-2 " + auth.body}>
          Go through all the details you provided and ensure they are all accurate
        </p>
      </div>

      <div className="mt-8 flex flex-col items-center">
        <AvatarUploader initials={avatarInitials} photoUrl={profile?.profilePhotoUrl} />
      </div>

      <div className="mt-6 rounded-xl border border-[hsl(var(--auth-input-border))] bg-white p-4 space-y-3">
        <div className="flex justify-between gap-4">
          <span className="text-sm text-auth-body">Full name</span>
          <span className="text-right text-sm font-semibold text-auth-heading">{fullName}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-sm text-auth-body">Phone number</span>
          <span className="text-right text-sm font-semibold text-auth-heading">{phone}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-sm text-auth-body">Nationality</span>
          <span className="text-right text-sm font-semibold text-auth-heading">{profile?.nationality ?? '—'}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-sm text-auth-body">Address</span>
          <span className="text-right text-sm font-semibold text-auth-heading">{address}</span>
        </div>
      </div>

      <p className="mt-6 text-sm text-auth-body">
        By tapping on Confirm and continue, you agree to Cohold Terms and Conditions and Privacy Policy.
      </p>
      <p className="mt-1 text-sm">
        <Link href="/terms" className={auth.link}>Terms and Conditions</Link>
        {' · '}
        <Link href="/privacy" className={auth.link}>Privacy Policy</Link>
      </p>

      {error && <div className={"mt-4 " + auth.errorBox}>{error}</div>}
      <button type="button" onClick={handleConfirm} disabled={completeOnboarding.isPending} className={"mt-6 " + auth.btnPrimary}>
        {completeOnboarding.isPending ? 'Completing...' : 'Confirm and continue'}
      </button>
    </main>
  );
}
