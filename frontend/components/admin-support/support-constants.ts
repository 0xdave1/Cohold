import type { SupportCategory, SupportStatus } from '@/lib/support/types';

export type AdminSupportAssignedFilter = 'me' | 'unassigned' | 'all';

export type AdminSupportFilter = {
  status?: SupportStatus;
  disputes?: boolean;
  assigned?: AdminSupportAssignedFilter;
};

export type AdminSupportConversationsQuery = {
  page: number;
  limit: number;
  search?: string;
  status?: SupportStatus;
  category?: SupportCategory;
  assigned?: AdminSupportAssignedFilter;
};

export const SUPPORT_TABS: Array<{ key: string; label: string; filter: AdminSupportFilter }> = [
  { key: 'unassigned', label: 'Unassigned', filter: { assigned: 'unassigned' } },
  { key: 'assigned', label: 'Assigned to me', filter: { assigned: 'me' } },
  { key: 'waiting_admin', label: 'Waiting for admin', filter: { status: 'WAITING_FOR_ADMIN' } },
  { key: 'waiting_user', label: 'Waiting for user', filter: { status: 'WAITING_FOR_USER' } },
  { key: 'disputes', label: 'Disputes', filter: { disputes: true } },
  { key: 'resolved', label: 'Resolved', filter: { status: 'RESOLVED' } },
];

export const CATEGORY_LABEL: Record<SupportCategory, string> = {
  GENERAL_SUPPORT: 'General support',
  PAYMENT_ISSUE: 'Payment issue',
  WITHDRAWAL_ISSUE: 'Withdrawal issue',
  INVESTMENT_ISSUE: 'Investment issue',
  WALLET_ISSUE: 'Wallet issue',
  KYC_ISSUE: 'KYC issue',
  PROPERTY_ISSUE: 'Property issue',
  DISPUTE: 'Dispute',
};

export function buildSupportConversationsQueryString(input: AdminSupportConversationsQuery): string {
  const p = new URLSearchParams();
  p.set('page', String(input.page));
  p.set('limit', String(input.limit));
  if (input.search?.trim()) p.set('search', input.search.trim());
  if (input.status) p.set('status', input.status);
  if (input.category) p.set('category', input.category);
  if (input.assigned) p.set('assigned', input.assigned);
  return p.toString();
}

