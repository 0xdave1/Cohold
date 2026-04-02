export type SupportCategory =
  | 'GENERAL_SUPPORT'
  | 'PAYMENT_ISSUE'
  | 'WITHDRAWAL_ISSUE'
  | 'INVESTMENT_ISSUE'
  | 'WALLET_ISSUE'
  | 'KYC_ISSUE'
  | 'PROPERTY_ISSUE'
  | 'DISPUTE';

export type SupportStatus =
  | 'OPEN'
  | 'WAITING_FOR_ADMIN'
  | 'WAITING_FOR_USER'
  | 'LIVE'
  | 'RESOLVED'
  | 'CLOSED';

export type SupportSenderType = 'USER' | 'ADMIN' | 'BOT' | 'SYSTEM';
export type SupportMessageType = 'TEXT' | 'INTERNAL_NOTE' | 'SYSTEM_EVENT';

export type SupportConversation = {
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
};

export type SupportAttachment = {
  id: string;
  messageId: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  fileName?: string | null;
  createdAt: string;
};

export type SupportMessage = {
  id: string;
  conversationId: string;
  senderType: SupportSenderType;
  senderUserId?: string | null;
  senderAdminId?: string | null;
  content: string;
  messageType: SupportMessageType;
  metadata?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
  attachments?: SupportAttachment[];
};

export type Paginated<T> = { items: T[]; meta: { page: number; limit: number; total: number } };

