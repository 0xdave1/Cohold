'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { useUnreadNotificationCount } from '@/lib/hooks/use-notifications';
import { useSupportUnreadCount } from '@/lib/hooks/use-support';

export function DashboardHeaderActions() {
  const { data: unreadData } = useUnreadNotificationCount();
  const { data: supportUnreadData } = useSupportUnreadCount();
  const unreadCount = unreadData?.unreadCount ?? 0;
  const supportUnreadCount = supportUnreadData?.unreadCount ?? 0;

  return (
    <div className="flex items-center gap-0.5 shrink-0" aria-label="Quick actions">
      <Link
        href="/dashboard/support"
        className="relative p-2 rounded-lg hover:bg-dashboard-border/50 transition-colors"
        aria-label={
          supportUnreadCount > 0
            ? `Support (${supportUnreadCount} unread replies)`
            : 'Support'
        }
      >
        <MessageCircle className="h-5 w-5 text-dashboard-body" strokeWidth={2} aria-hidden />
        {supportUnreadCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white"
            aria-hidden
          >
            {supportUnreadCount > 99 ? '99+' : supportUnreadCount}
          </span>
        )}
      </Link>
      <Link
        href="/dashboard/notifications"
        className="relative p-2 rounded-lg hover:bg-dashboard-border/50 transition-colors"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
      >
        <svg className="h-5 w-5 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white"
            aria-hidden
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Link>
    </div>
  );
}
