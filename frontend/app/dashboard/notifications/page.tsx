'use client';

import { useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/EmptyState';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type Notification,
  type NotificationType,
} from '@/lib/hooks/use-notifications';

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function getNotificationIcon(type: NotificationType): string {
  switch (type) {
    case 'INVESTMENT_SUCCESS':
    case 'INVESTMENT_SOLD':
      return '📈';
    case 'WALLET_FUNDED':
      return '💰';
    case 'WITHDRAWAL_INITIATED':
    case 'WITHDRAWAL_COMPLETED':
      return '💸';
    case 'WITHDRAWAL_FAILED':
      return '⚠️';
    case 'KYC_APPROVED':
      return '✅';
    case 'KYC_REJECTED':
      return '❌';
    case 'KYC_REQUIRES_REVIEW':
      return '🔍';
    case 'PROPERTY_UPDATE':
      return '🏠';
    case 'ROI_CREDITED':
      return '🎉';
    case 'WELCOME':
      return '👋';
    case 'SYSTEM_MESSAGE':
    default:
      return '📢';
  }
}

interface NotificationCardProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  isMarking: boolean;
}

function NotificationCard({ notification, onMarkRead, isMarking }: NotificationCardProps) {
  const router = useRouter();
  const icon = getNotificationIcon(notification.type);
  const timeAgo = formatRelativeTime(notification.createdAt);

  const handleClick = useCallback(() => {
    if (!notification.isRead) {
      onMarkRead(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
    }
  }, [notification, onMarkRead, router]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isMarking}
      className={`w-full text-left p-4 rounded-xl border transition-colors ${
        notification.isRead
          ? 'bg-dashboard-card border-dashboard-border'
          : 'bg-blue-50/50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30'
      } ${notification.link ? 'cursor-pointer hover:bg-dashboard-border/30' : ''} ${
        isMarking ? 'opacity-60' : ''
      }`}
    >
      <div className="flex gap-3">
        <div className="shrink-0 text-xl" aria-hidden>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`font-medium text-sm ${
                notification.isRead ? 'text-dashboard-body' : 'text-dashboard-heading'
              }`}
            >
              {notification.title}
            </h3>
            {!notification.isRead && (
              <span className="shrink-0 h-2 w-2 rounded-full bg-blue-500 mt-1.5" aria-label="Unread" />
            )}
          </div>
          <p className="text-sm text-dashboard-body mt-0.5 line-clamp-2">{notification.message}</p>
          <p className="text-xs text-dashboard-body/60 mt-1.5">{timeAgo}</p>
        </div>
      </div>
    </button>
  );
}

export default function NotificationsPage() {
  const { data, isLoading, isError, error } = useNotifications({ limit: 50 });
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const notifications = data?.data ?? [];
  const hasUnread = useMemo(
    () => notifications.some((n) => !n.isRead),
    [notifications],
  );

  const handleMarkRead = useCallback(
    (id: string) => {
      markReadMutation.mutate(id);
    },
    [markReadMutation],
  );

  const handleMarkAllRead = useCallback(() => {
    markAllReadMutation.mutate();
  }, [markAllReadMutation]);

  return (
    <div className="min-h-screen bg-dashboard-bg pb-20">
      <div className="space-y-4 px-4 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
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

          {hasUnread && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-1.5 text-sm text-cohold-blue hover:text-cohold-blue/80 disabled:opacity-50 font-medium"
            >
              {markAllReadMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4" />
              )}
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-dashboard-body" />
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-sm text-red-700">
              {error instanceof Error ? error.message : 'Failed to load notifications'}
            </p>
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            title="No notifications yet"
            message="You don't have any notifications yet. All your updates will appear here."
            icon={<Bell className="h-7 w-7" />}
            className="p-8"
          />
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onMarkRead={handleMarkRead}
                isMarking={
                  markReadMutation.isPending &&
                  markReadMutation.variables === notification.id
                }
              />
            ))}

            {data?.meta.hasMore && (
              <p className="text-center text-sm text-dashboard-body py-2">
                Showing {notifications.length} of {data.meta.total} notifications
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

