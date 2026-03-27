'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-dashboard-bg pb-20">
      <div className="space-y-6 px-4 pt-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/account" className="p-2 rounded-lg hover:bg-dashboard-border/50 text-dashboard-heading" aria-label="Back">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-xl font-semibold text-dashboard-heading">Terms and Conditions</h1>
        </div>
        <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-6 prose prose-sm max-w-none text-dashboard-body">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-dashboard-heading" />
            <h2 className="text-lg font-semibold text-dashboard-heading m-0">Cohold Terms of Service</h2>
          </div>
          <p className="text-sm">By using Cohold you agree to these terms. Investments are subject to risk. We may update these terms from time to time.</p>
          <p className="text-sm text-dashboard-muted mt-6">For the full legal text contact legal@cohold.com.</p>
        </div>
      </div>
    </div>
  );
}
