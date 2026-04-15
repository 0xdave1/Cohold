import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthReady } from '@/lib/hooks/use-auth-ready';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'INVESTMENT_SUCCESS'
  | 'INVESTMENT_SOLD'
  | 'WALLET_FUNDED'
  | 'WITHDRAWAL_INITIATED'
  | 'WITHDRAWAL_COMPLETED'
  | 'WITHDRAWAL_FAILED'
  | 'KYC_APPROVED'
  | 'KYC_REJECTED'
  | 'KYC_REQUIRES_REVIEW'
  | 'PROPERTY_UPDATE'
  | 'ROI_CREDITED'
  | 'SYSTEM_MESSAGE'
  | 'WELCOME';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  link: string | null;
  /** Backend JSON metadata — shape varies by notification type */
  metadata: unknown;
  createdAt: string;
}

export interface NotificationsResponse {
  data: Notification[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface ListNotificationsParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// ─────────────────────────────────────────────────────────────────────────────

/** Prefix for all notification queries (list + unread count). */
export const NOTIFICATIONS_QUERY_KEY = ['notifications'] as const;
export const NOTIFICATIONS_UNREAD_COUNT_KEY = [
  ...NOTIFICATIONS_QUERY_KEY,
  'unread-count',
] as const;

async function invalidateAllNotificationQueries(queryClient: QueryClient) {
  // Partial key match: invalidates list (`['notifications', { page, ... }]`) and unread count.
  await queryClient.invalidateQueries({ queryKey: [...NOTIFICATIONS_QUERY_KEY] });
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch paginated notifications for the current user.
 */
export function useNotifications(params: ListNotificationsParams = {}) {
  const authReady = useAuthReady();
  const { page = 1, limit = 20, unreadOnly = false } = params;

  return useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, { page, limit, unreadOnly }] as const,
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      queryParams.set('page', String(page));
      queryParams.set('limit', String(limit));
      if (unreadOnly) queryParams.set('unreadOnly', 'true');

      const res = await apiClient.get<NotificationsResponse>(
        `/notifications?${queryParams.toString()}`,
      );

      if (!res.success) {
        throw new Error(res.error ?? 'Failed to fetch notifications');
      }

      return res.data;
    },
    enabled: authReady,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

/**
 * Fetch unread notification count for the bell badge.
 */
export function useUnreadNotificationCount() {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: [...NOTIFICATIONS_UNREAD_COUNT_KEY],
    queryFn: async () => {
      const res = await apiClient.get<UnreadCountResponse>('/notifications/unread-count');
      if (!res.success) {
        throw new Error(res.error ?? 'Failed to fetch unread count');
      }
      return res.data;
    },
    enabled: authReady,
    staleTime: 30000,
    refetchInterval: 60000, // Refresh every minute
    refetchOnWindowFocus: true,
  });
}

/**
 * Mark a single notification as read.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await apiClient.patch<Notification>(
        `/notifications/${notificationId}/read`,
      );
      if (!res.success) {
        throw new Error(res.error ?? 'Failed to mark notification as read');
      }
      return res.data;
    },
    onSettled: async () => {
      await invalidateAllNotificationQueries(queryClient);
    },
  });
}

/**
 * Mark all notifications as read.
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.patch<{ markedCount: number }>(
        '/notifications/read-all',
      );
      if (!res.success) {
        throw new Error(res.error ?? 'Failed to mark all notifications as read');
      }
      return res.data;
    },
    onSettled: async () => {
      await invalidateAllNotificationQueries(queryClient);
    },
  });
}
