'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/EmptyState';

export default function NotificationsPage() {
  return (
    <div className="min-h-screen bg-dashboard-bg pb-20">
      <div className="space-y-6 px-4 pt-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/home"
            className="p-2 rounded-lg hover:bg-dashboard-border/50 text-dashboard-heading"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-semibold text-dashboard-heading">Notifications</h1>
        </div>
        <EmptyState
          title="No notifications yet."
          message="You don't have any notifications yet. All your notification updates will appear here."
          icon={<Bell className="h-7 w-7" />}
          className="p-8"
        />
      </div>
    </div>
  );
}

