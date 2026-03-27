'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-dashboard-bg pb-20">
      <div className="space-y-6 px-4 pt-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/account" className="p-2 rounded-lg hover:bg-dashboard-border/50 text-dashboard-heading" aria-label="Back">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-xl font-semibold text-dashboard-heading">Privacy policy</h1>
        </div>

        <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-6 prose prose-sm max-w-none text-dashboard-body">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-5 w-5 text-dashboard-heading" />
            <h2 className="text-lg font-semibold text-dashboard-heading m-0">Cohold Privacy Policy</h2>
          </div>
          <p className="text-sm">We respect your privacy and are committed to protecting your personal data.</p>
          <h3 className="text-base font-semibold text-dashboard-heading mt-4">Information we collect</h3>
          <p className="text-sm">We collect information you provide when you register, complete KYC, make investments, or contact support. This may include name, email, phone, address, and identity documents.</p>
          <h3 className="text-base font-semibold text-dashboard-heading mt-4">How we use it</h3>
          <p className="text-sm">We use your data to operate the platform, verify your identity, process transactions, and communicate with you. We do not sell your personal information.</p>
          <h3 className="text-base font-semibold text-dashboard-heading mt-4">Security</h3>
          <p className="text-sm">We use industry-standard measures to protect your data. Access is restricted to authorised personnel only.</p>
          <p className="text-sm text-dashboard-muted mt-6">For questions, contact privacy@cohold.com.</p>
        </div>
      </div>
    </div>
  );
}
