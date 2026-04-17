import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { Paginated, SupportConversation, SupportMessage, SupportCategory } from '@/lib/support/types';
import { useAuthReady } from '@/lib/hooks/use-auth-ready';

export const SUPPORT_QUERY_KEY = ['support', 'conversations'] as const;
export const SUPPORT_UNREAD_COUNT_QUERY_KEY = ['support', 'unread-count'] as const;

type SupportUnreadCountResponse = { unreadCount: number };

async function invalidateSupportQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['support'] }),
    queryClient.invalidateQueries({ queryKey: SUPPORT_UNREAD_COUNT_QUERY_KEY }),
  ]);
}

export function useSupportConversations() {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: SUPPORT_QUERY_KEY,
    queryFn: async () => {
      const res = await apiClient.get<SupportConversation[]>('/support/conversations');
      if (!res.success) throw new Error(res.error ?? 'Failed to load support conversations');
      return res.data;
    },
    enabled: authReady,
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useSupportUnreadCount() {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: SUPPORT_UNREAD_COUNT_QUERY_KEY,
    queryFn: async () => {
      const res = await apiClient.get<SupportUnreadCountResponse>('/support/unread-count');
      if (!res.success) throw new Error(res.error ?? 'Failed to load support unread count');
      return res.data;
    },
    enabled: authReady,
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });
}

export function useSupportConversation(conversationId: string | null) {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ['support', 'conversation', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const res = await apiClient.get<SupportConversation>(`/support/conversations/${conversationId}`);
      if (!res.success) throw new Error(res.error ?? 'Failed to load conversation');
      return res.data;
    },
    enabled: !!conversationId && authReady,
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useSupportMessages(conversationId: string | null, page = 1, limit = 50) {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ['support', 'messages', conversationId, page, limit],
    queryFn: async () => {
      if (!conversationId) return { items: [], meta: { page, limit, total: 0 } } as Paginated<SupportMessage>;
      const res = await apiClient.get<Paginated<SupportMessage>>(
        `/support/conversations/${conversationId}/messages`,
        { page, limit },
      );
      if (!res.success) throw new Error(res.error ?? 'Failed to load messages');
      return res.data;
    },
    enabled: !!conversationId && authReady,
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useCreateSupportConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      category: SupportCategory;
      subject?: string;
      priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
      metadata?: Record<string, unknown>;
    }) => {
      const res = await apiClient.post<SupportConversation>('/support/conversations', body);
      if (!res.success) throw new Error(res.error ?? 'Failed to create conversation');
      return res.data;
    },
    onSuccess: async () => {
      await invalidateSupportQueries(queryClient);
    },
  });
}

export function useSendSupportMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      conversationId: string;
      messageId?: string;
      content: string;
      attachments?: Array<{ storageKey: string; mimeType: string; sizeBytes: number; fileName?: string }>;
      metadata?: Record<string, unknown>;
    }) => {
      const res = await apiClient.post<SupportMessage>(`/support/conversations/${body.conversationId}/messages`, {
        messageId: body.messageId,
        content: body.content,
        attachments: body.attachments,
        metadata: body.metadata,
      });
      if (!res.success) throw new Error(res.error ?? 'Failed to send message');
      return res.data;
    },
    onSuccess: async (_msg, vars) => {
      await Promise.all([
        invalidateSupportQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ['support', 'messages', vars.conversationId] }),
      ]);
    },
  });
}

export function useMarkSupportConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await apiClient.patch<{ markedCount: number }>(
        `/support/conversations/${conversationId}/read`,
      );
      if (!res.success) throw new Error(res.error ?? 'Failed to mark support messages as read');
      return res.data;
    },
    onSuccess: async (_data, conversationId) => {
      await Promise.all([
        invalidateSupportQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ['support', 'conversation', conversationId] }),
        queryClient.invalidateQueries({ queryKey: ['support', 'messages', conversationId] }),
      ]);
    },
  });
}

export function usePresignSupportAttachment() {
  return useMutation({
    mutationFn: async (body: { conversationId: string; messageId: string; mimeType: string; fileName?: string }) => {
      const res = await apiClient.post<{ storageKey: string; uploadUrl: string }>('/support/attachments/presign', body);
      if (!res.success) throw new Error(res.error ?? 'Failed to prepare upload');
      return res.data;
    },
  });
}

