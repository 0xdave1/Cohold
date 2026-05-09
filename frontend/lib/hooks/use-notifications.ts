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

export type NotificationDeliveryState =
  | 'IN_APP_CREATED'
  | 'EMAIL_PENDING'
  | 'EMAIL_SENT'
  | 'EMAIL_FAILED'
  | 'WEBSOCKET_DELIVERED'
  | 'DELIVERY_RETRYING'
  | 'DEAD_LETTER'
  | 'UNKNOWN';

export type NotificationDeliveryView = {
  state: NotificationDeliveryState;
  label: string;
};

function getDeliveryStatusRaw(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const row = metadata as Record<string, unknown>;
  const direct = row.deliveryStatus;
  if (typeof direct === 'string') return direct;
  const nested = row.delivery;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const status = (nested as Record<string, unknown>).status;
    if (typeof status === 'string') return status;
  }
  return undefined;
}

/**
 * Truthful delivery state mapper: never claims email is sent unless backend status says SENT.
 */
export function getNotificationDeliveryView(notification: Notification): NotificationDeliveryView {
  const raw = (getDeliveryStatusRaw(notification.metadata) ?? '').toUpperCase();
  if (raw === 'PENDING' || raw === 'EMAIL_PENDING') return { state: 'EMAIL_PENDING', label: 'Email pending' };
  if (raw === 'SENT' || raw === 'EMAIL_SENT') return { state: 'EMAIL_SENT', label: 'Email sent' };
  if (raw === 'FAILED' || raw === 'EMAIL_FAILED') return { state: 'EMAIL_FAILED', label: 'Delivery failed' };
  if (raw === 'PROCESSING' || raw === 'RETRYING') {
    return { state: 'DELIVERY_RETRYING', label: 'Delivery retrying' };
  }
  if (raw === 'DEAD_LETTER') return { state: 'DEAD_LETTER', label: 'Manual attention required' };
  if (raw === 'WEBSOCKET_DELIVERED') {
    return { state: 'WEBSOCKET_DELIVERED', label: 'Notification saved' };
  }
  return { state: 'IN_APP_CREATED', label: 'Notification saved' };
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
    /** Pause polling after failures (e.g. 429) so the bell badge does not hammer the API (Issue 9). */
    refetchInterval: (query) => (query.state.fetchFailureCount > 0 ? false : 60_000),
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
