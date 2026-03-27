'use client';

import Link from 'next/link';
import { Fingerprint } from 'lucide-react';

export default function BiometricsPage() {
  return (
    <div className="min-h-screen bg-dashboard-bg pb-20">
      <div className="space-y-6 px-4 pt-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/account" className="p-2 rounded-lg hover:bg-dashboard-border/50 text-dashboard-heading" aria-label="Back">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-xl font-semibold text-dashboard-heading">Biometrics</h1>
        </div>
        <p className="text-sm text-dashboard-body">Use fingerprint or face to sign in securely.</p>

        <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-8 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-cohold-icon-bg flex items-center justify-center mb-4">
            <Fingerprint className="h-8 w-8 text-dashboard-heading" />
          </div>
          <h2 className="text-lg font-semibold text-dashboard-heading mb-2">Biometric login</h2>
          <p className="text-sm text-dashboard-body mb-6 max-w-sm mx-auto">Biometric authentication will be available in a future update. Continue using your password to sign in.</p>
          <Link href="/dashboard/account" className="inline-block rounded-xl bg-cohold-blue px-6 py-3 text-sm font-medium text-white hover:opacity-90">Back to Account</Link>
        </div>
      </div>
    </div>
  );
}
