'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-dashboard-bg pb-20">
      <div className="space-y-6 px-4 pt-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/account" className="p-2 rounded-lg hover:bg-dashboard-border/50 text-dashboard-heading" aria-label="Back">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-xl font-semibold text-dashboard-heading">Contact us</h1>
        </div>
        <p className="text-sm text-dashboard-body">Get in touch with the Cohold team.</p>
        <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-6">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-10 w-10 text-dashboard-heading" />
            <div>
              <p className="font-medium text-dashboard-heading">Support</p>
              <p className="text-sm text-dashboard-body">Email: support@cohold.com. We respond within 24 hours.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
