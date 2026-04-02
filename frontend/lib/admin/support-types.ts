import type { SupportCategory, SupportStatus, SupportMessageType, SupportSenderType } from '@/lib/support/types';

export type AdminSupportConversation = {
  id: string;
  referenceCode: string;
  category: SupportCategory;
  status: SupportStatus;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  isDispute: boolean;
  subject: string | null;
  metadata?: Record<string, unknown> | null;
  assignedAdminId?: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; firstName?: string | null; lastName?: string | null };
  assignedAdmin?: { id: string; email: string; fullName?: string | null } | null;
};

export type AdminSupportMessage = {
  id: string;
  conversationId: string;
  senderType: SupportSenderType;
  senderUserId?: string | null;
  senderAdminId?: string | null;
  content: string;
  messageType: SupportMessageType;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  attachments?: Array<{
    id: string;
    messageId: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    fileName?: string | null;
    createdAt: string;
  }>;
};

export type AdminSupportPresence = {
  adminId: string;
  isOnline: boolean;
  lastSeenAt: string;
};

