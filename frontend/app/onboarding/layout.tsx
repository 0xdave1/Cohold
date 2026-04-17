import type { ReactNode } from 'react';
import { OnboardingGuard } from '@/components/onboarding/OnboardingGuard';
import { OnboardingBackLink } from '@/components/onboarding/OnboardingBackLink';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <OnboardingGuard>
    <div className="min-h-screen flex flex-col bg-auth-bg">
      <header className="flex items-center justify-between px-3 py-3 sm:px-4">
        <OnboardingBackLink />
      </header>
      <main className="flex-1 flex items-center justify-center px-3 py-6 sm:px-4">
        <div className="w-full sm:max-w-[400px]">{children}</div>
      </main>
    </div>
    </OnboardingGuard>
  );
}
