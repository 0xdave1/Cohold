'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { SupportPagePanel } from '@/components/support/SupportPagePanel';

export default function DashboardSupportPage() {
  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/home"
        className="inline-flex items-center gap-1 text-sm font-medium text-dashboard-body hover:text-dashboard-heading transition-colors"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Home
      </Link>
      <SupportPagePanel />
    </div>
  );
}
