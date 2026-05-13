'use client';

import { useRouter } from 'next/navigation';
import { auth } from '@/components/auth/auth-styles';

export default function OnboardingSuccessPage() {
  const router = useRouter();

  return (
    <main className={auth.card + ' text-center'}>
      <p className={auth.pageTitle}>Successful onboarding</p>
      <div className="mt-4 flex flex-col items-center">
        <div className="relative flex h-[88px] w-[88px] items-center justify-center rounded-2xl bg-cohold-logo-soft sm:h-24 sm:w-24">
          <svg
            className="h-12 w-12 text-cohold-primary sm:h-14 sm:w-14"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path
              d="M4.5 12.5l4 4L14 11"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8 12.5l4 4L19.5 7"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.45"
            />
          </svg>
        </div>
        <h1 className={'mt-5 ' + auth.heading}>Hooray! 🎉</h1>
        <p className={'mt-2 max-w-sm ' + auth.body}>
          You&apos;re welcome to Cohold. Now you can confidently own, outrightly own and acquire properties in
          instalments. Begin exploring!
        </p>
      </div>
      <button type="button" onClick={() => router.push('/dashboard')} className={'mt-8 ' + auth.btnPrimary}>
        Go to Home
      </button>
    </main>
  );
}
