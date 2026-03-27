'use client';

import { useRouter } from 'next/navigation';
import { auth } from '@/components/auth/auth-styles';

export default function OnboardingSuccessPage() {
  const router = useRouter();

  return (
    <main className={auth.card + " text-center"}>
      <p className={auth.pageTitle}>successful onboarding</p>
      <div className="mt-8 flex flex-col items-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-[#E6F7F9]">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-cohold-blue">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className={"mt-6 " + auth.heading}>Hoooray!</h1>
        <p className={"mt-2 max-w-sm " + auth.body}>
          You&apos;re welcome to Cohold. Now you can confidently own, outrightly own and acquire properties in instalments. Begin exploring!
        </p>
      </div>
      <button
        type="button"
        onClick={() => router.push('/dashboard')}
        className={"mt-8 " + auth.btnPrimary}
      >
        Go to Home
      </button>
    </main>
  );
}
