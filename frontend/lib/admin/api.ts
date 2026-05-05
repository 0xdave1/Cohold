import { apiClient } from '@/lib/api/client';
import type { LedgerReconciliationReport } from '@/lib/admin/ledger-reconciliation';

async function adminGet<T>(path: string): Promise<T> {
  const res = await apiClient.get<T>(`/${path}`);
  if (!res.success) throw new Error(res.error ?? 'Request failed');
  return res.data;
}

async function adminPost<T, B = unknown>(path: string, body?: B): Promise<T> {
  const res = await apiClient.post<T, B>(`/${path}`, body);
  if (!res.success) throw new Error(res.error ?? 'Request failed');
  return res.data;
}

async function adminPatch<T, B = unknown>(path: string, body?: B): Promise<T> {
  const res = await apiClient.patch<T, B>(`/${path}`, body);
  if (!res.success) throw new Error(res.error ?? 'Request failed');
  return res.data;
}

async function adminDelete<T>(path: string): Promise<T> {
  const res = await apiClient.del<T>(`/${path}`);
  if (!res.success) throw new Error(res.error ?? 'Request failed');
  return res.data;
}

export const adminApi = {
  dashboard: () => adminGet<any>('admin/dashboard/overview'),
  users: (params?: string) => adminGet<any>(`admin/users${params ? `?${params}` : ''}`),
  userDetail: (id: string) => adminGet<any>(`admin/users/${id}`),
  userTransactions: (id: string, params?: string) =>
    adminGet<any>(`admin/users/${id}/transactions${params ? `?${params}` : ''}`),
  suspendUser: (id: string) => adminPost<any>(`admin/users/${id}/suspend`),
  deleteUser: (id: string) => adminDelete<any>(`admin/users/${id}`),
  verifications: (params?: string) => adminGet<any>(`admin/verifications${params ? `?${params}` : ''}`),
  approveKyc: (id: string) => adminPost<any>(`admin/verifications/${id}/approve`),
  rejectKyc: (id: string, body: { reason: string }) => adminPost<any>(`admin/verifications/${id}/reject`, body),
  getKycSignedReadUrl: (userId: string, slot: 'ID_FRONT' | 'ID_BACK' | 'SELFIE') =>
    adminGet<{ url: string }>(`admin/users/${userId}/kyc-documents/${slot}/signed-read`),
  properties: (params?: string) => adminGet<any>(`admin/properties${params ? `?${params}` : ''}`),
  propertyDetail: (id: string) => adminGet<any>(`admin/properties/${id}`),
  propertyInvestors: (id: string, params?: string) =>
    adminGet<any>(`admin/properties/${id}/investors${params ? `?${params}` : ''}`),
  closeProperty: (id: string) => adminPost<any>(`admin/properties/${id}/close`),
  deleteProperty: (id: string) => adminDelete<any>(`admin/properties/${id}`),
  walletTransactions: (params?: string) => adminGet<any>(`admin/wallet-transactions${params ? `?${params}` : ''}`),
  withdrawals: (params?: string) => adminGet<any>(`admin/withdrawals${params ? `?${params}` : ''}`),
  reconcileWithdrawal: (id: string) => adminPost<any>(`admin/withdrawals/${id}/reconcile`),
  reconcileStaleWithdrawals: (params?: string) =>
    adminPost<any>(`admin/withdrawals/reconcile-stale${params ? `?${params}` : ''}`),
  disputes: (params?: string) => adminGet<any>(`admin/disputes${params ? `?${params}` : ''}`),
  admins: (params?: string) => adminGet<any>(`admin/admins${params ? `?${params}` : ''}`),
  adminDetail: (id: string) => adminGet<any>(`admin/admins/${id}`),
  createProperty: (body: Record<string, unknown>) => adminPost<any, Record<string, unknown>>('admin/properties', body),
  createAdmin: (body: {
    fullName: string;
    email: string;
    phoneNumber?: string | null;
    role: 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'OPERATION_ADMIN' | 'COMPLIANCE_ADMIN';
  }) => adminPost<any, typeof body>('admin/admins', body),
  updateAdmin: (
    id: string,
    body: {
      fullName?: string;
      email?: string;
      phoneNumber?: string | null;
      role?: 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'OPERATION_ADMIN' | 'COMPLIANCE_ADMIN';
    },
  ) => adminPatch<any, typeof body>(`admin/admins/${id}`, body),
  suspendAdmin: (id: string) => adminPost<any>(`admin/admins/${id}/suspend`),
  deactivateAdmin: (id: string) => adminPost<any>(`admin/admins/${id}/deactivate`),
  fees: (params?: string) => adminGet<any>(`admin/fees${params ? `?${params}` : ''}`),
  coholds: (params?: string) => adminGet<any>(`admin/coholds${params ? `?${params}` : ''}`),
  activityLog: (params?: string) => adminGet<any>(`admin/activity-log${params ? `?${params}` : ''}`),
  ledgerReconciliation: () => adminGet<LedgerReconciliationReport>('admin/ledger/reconciliation'),

  // Support inbox
  supportConversations: (params?: string) => adminGet<any>(`admin/support/conversations${params ? `?${params}` : ''}`),
  supportConversation: (id: string) => adminGet<any>(`admin/support/conversations/${id}`),
  supportMessages: (id: string, params?: string) =>
    adminGet<any>(`admin/support/conversations/${id}/messages${params ? `?${params}` : ''}`),
  sendSupportMessage: (id: string, body: any) =>
    adminPost<any, any>(`admin/support/conversations/${id}/messages`, body),
  addSupportInternalNote: (id: string, body: any) =>
    adminPost<any, any>(`admin/support/conversations/${id}/internal-notes`, body),
  assignSupportConversation: (id: string, body?: any) =>
    adminPost<any, any>(`admin/support/conversations/${id}/assign`, body ?? {}),
  resolveSupportConversation: (id: string) =>
    adminPost<any>(`admin/support/conversations/${id}/resolve`),
  setSupportPresence: (body: { isOnline: boolean }) =>
    adminPost<any, { isOnline: boolean }>('admin/support/presence', body),
  onlineSupportAgents: () => adminGet<any>('admin/support/presence/online'),
  presignSupportAttachment: (body: any) =>
    adminPost<any, any>('admin/support/attachments/presign', body),

  presignPropertyImage: (propertyId: string, body: any) =>
    adminPost<any, any>(`admin/properties/${propertyId}/images/presign`, body),
  completePropertyImage: (propertyId: string, body: any) =>
    adminPost<any, any>(`admin/properties/${propertyId}/images/complete`, body),
  presignPropertyDocument: (propertyId: string, body: any) =>
    adminPost<any, any>(`admin/properties/${propertyId}/documents/presign`, body),
  completePropertyDocument: (propertyId: string, body: any) =>
    adminPost<any, any>(`admin/properties/${propertyId}/documents/complete`, body),
};
