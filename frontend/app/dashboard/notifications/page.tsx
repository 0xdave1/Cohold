'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/EmptyState';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type Notification,
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

type NotificationMetadata = {
  event?: string;
  source?: string;
};

function getNotificationMetadata(metadata: unknown): NotificationMetadata {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }
  const maybeEvent = (metadata as { event?: unknown }).event;
  const maybeSource = (metadata as { source?: unknown }).source;
  return {
    event: typeof maybeEvent === 'string' ? maybeEvent : undefined,
    source: typeof maybeSource === 'string' ? maybeSource : undefined,
  };
}

function isSupportReplyNotification(notification: Notification): boolean {
  const { event, source } = getNotificationMetadata(notification.metadata);
  if (source === 'support') return true;
  if (!event) return false;
  return event === 'SUPPORT_REPLY' || event === 'SUPPORT_ADMIN_REPLY';
}

function getNotificationIcon(notification: Notification): string {
  const { event } = getNotificationMetadata(notification.metadata);
  if (event === 'P2P_INCOMING') return '💸';
  if (event === 'WALLET_CREDIT') return '💰';
  if (isSupportReplyNotification(notification)) return '💬';

  switch (notification.type) {
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
  onMarkRead: (id: string) => Promise<void>;
  isMarking: boolean;
}

function NotificationCard({
  notification,
  onMarkRead,
  isMarking,
}: NotificationCardProps) {
  const router = useRouter();
  const icon = getNotificationIcon(notification);
  const timeAgo = formatRelativeTime(notification.createdAt);

  const handleClick = useCallback(async () => {
    try {
      if (!notification.isRead) {
        await onMarkRead(notification.id);
      }

      if (notification.link) {
        router.push(notification.link);
      }
    } catch {
      if (notification.link) {
        router.push(notification.link);
      }
    }
  }, [notification, onMarkRead, router]);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-busy={isMarking}
      className={`w-full rounded-xl border p-4 text-left transition-colors ${
        notification.isRead
          ? 'border-dashboard-border bg-dashboard-card'
          : 'border-blue-100 bg-blue-50/50 dark:border-blue-900/30 dark:bg-blue-950/20'
      } ${notification.link ? 'cursor-pointer hover:bg-dashboard-border/30' : ''} ${
        isMarking ? 'opacity-60' : ''
      }`}
    >
      <div className="flex gap-3">
        <div className="shrink-0 text-xl" aria-hidden>
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`text-sm font-medium ${
                notification.isRead
                  ? 'text-dashboard-body'
                  : 'text-dashboard-heading'
              }`}
            >
              {notification.title}
            </h3>

            {!notification.isRead && (
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500"
                aria-label="Unread"
              />
            )}
          </div>

          <p className="mt-0.5 line-clamp-2 text-sm text-dashboard-body">
            {notification.message}
          </p>

          <p className="mt-1.5 text-xs text-dashboard-body/60">{timeAgo}</p>
        </div>
      </div>
    </button>
  );
}

export default function NotificationsPage() {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useNotifications({ limit: 50 });

  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const notifications = data?.data ?? [];
  const hasUnread = notifications.some((n) => !n.isRead);

  const handleMarkRead = useCallback(
    async (id: string) => {
      await markReadMutation.mutateAsync(id);
    },
    [markReadMutation],
  );

  const handleMarkAllRead = useCallback(() => {
    markAllReadMutation.mutate();
  }, [markAllReadMutation]);

  return (
    <div className="min-h-screen bg-dashboard-bg pb-20">
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/home"
              className="rounded-lg p-2 text-dashboard-heading hover:bg-dashboard-border/50"
              aria-label="Back"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>

            <h1 className="text-xl font-semibold text-dashboard-heading">
              Notifications
            </h1>
          </div>

          {hasUnread && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-1.5 font-medium text-cohold-blue hover:text-cohold-blue/80 disabled:opacity-50 text-sm"
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

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-dashboard-body" />
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center dark:border-red-900/40 dark:bg-red-950/30">
            <p className="text-sm text-red-700 dark:text-red-300">
              {error instanceof Error
                ? error.message
                : 'Failed to load notifications'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-2 text-sm font-medium text-red-600 underline dark:text-red-400"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {markAllReadMutation.isError ? (
              <div
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
              >
                <p>
                  {markAllReadMutation.error instanceof Error
                    ? markAllReadMutation.error.message
                    : 'Could not mark all as read. Please try again.'}
                </p>
                <button
                  type="button"
                  onClick={() => markAllReadMutation.reset()}
                  className="mt-2 text-sm font-medium underline"
                >
                  Dismiss
                </button>
              </div>
            ) : null}

            {notifications.length === 0 ? (
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

                {data?.meta.hasMore ? (
                  <p className="py-2 text-center text-sm text-dashboard-body">
                    Showing {notifications.length} of {data.meta.total}{' '}
                    notifications
                  </p>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}