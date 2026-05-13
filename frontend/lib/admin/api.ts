import { apiClient } from '@/lib/api/client';
import type { LedgerReconciliationReport } from '@/lib/admin/ledger-reconciliation';

export type AdminOutboxStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'DEAD_LETTER'
  | 'CANCELLED';

export type AdminOutboxEvent = {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string | null;
  idempotencyKey: string;
  status: AdminOutboxStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lockedAt: string | null;
  lockedBy: string | null;
  payload?: unknown;
  sanitizedPayload?: unknown;
  lastError: string | null;
  lastErrorAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminJobState = {
  name: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  nextRunAt: string | null;
};

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

async function adminDelete<T, B = unknown>(path: string, body?: B): Promise<T> {
  const res = await apiClient.del<T, B>(`/${path}`, body);
  if (!res.success) throw new Error(res.error ?? 'Request failed');
  return res.data;
}

export const adminApi = {
  dashboard: () => adminGet<any>('admin/dashboard/overview'),
  opsSummary: () => adminGet<any>('admin/ops/summary'),
  launchReadiness: () => adminGet<Record<string, unknown>>('admin/launch-readiness'),
  users: (params?: string) => adminGet<any>(`admin/users${params ? `?${params}` : ''}`),
  userDetail: (id: string) => adminGet<any>(`admin/users/${id}`),
  userTransactions: (id: string, params?: string) =>
    adminGet<any>(`admin/users/${id}/transactions${params ? `?${params}` : ''}`),
  suspendUser: (id: string, body: { reason: string }) => adminPost<any>(`admin/users/${id}/suspend`, body),
  freezeUser: (id: string, body: { reason: string }) => adminPost<any>(`admin/users/${id}/freeze`, body),
  unfreezeUser: (id: string, body: { reason: string }) => adminPost<any>(`admin/users/${id}/unfreeze`, body),
  deleteUser: (id: string, body: { reason: string }) => adminDelete<any, typeof body>(`admin/users/${id}`, body),
  verifications: (params?: string) => adminGet<any>(`admin/verifications${params ? `?${params}` : ''}`),
  approveKyc: (id: string) => adminPost<any>(`admin/verifications/${id}/approve`),
  rejectKyc: (id: string, body: { failureReason: string }) => adminPost<any>(`admin/verifications/${id}/reject`, body),
  getKycSignedReadUrl: (userId: string, slot: 'ID_FRONT' | 'ID_BACK' | 'SELFIE') =>
    adminGet<{ url: string }>(`admin/users/${userId}/kyc-documents/${slot}/signed-read`),
  retryVirtualAccountProvisioning: (userId: string, body: { reason: string }) =>
    adminPost<any>(`admin/users/${userId}/virtual-account/retry`, body),
  failedVirtualAccounts: (params?: string) =>
    adminGet<any>(`admin/virtual-accounts/failed${params ? `?${params}` : ''}`),
  unmatchedVirtualAccountDeposits: (params?: string) =>
    adminGet<any>(`admin/virtual-accounts/unmatched-deposits${params ? `?${params}` : ''}`),
  properties: (params?: string) => adminGet<any>(`admin/properties${params ? `?${params}` : ''}`),
  propertyDetail: (id: string) => adminGet<any>(`admin/properties/${id}`),
  propertyInvestors: (id: string, params?: string) =>
    adminGet<any>(`admin/properties/${id}/investors${params ? `?${params}` : ''}`),
  closeProperty: (id: string, body: { reason: string }) => adminPost<any, typeof body>(`admin/properties/${id}/close`, body),
  publishProperty: (id: string) => adminPost<any>(`admin/properties/${id}/publish`),
  unpublishProperty: (id: string, body: { reason: string }) => adminPost<any>(`admin/properties/${id}/unpublish`, body),
  deleteProperty: (id: string, body: { reason: string }) =>
    adminDelete<any, typeof body>(`admin/properties/${id}`, body),
  walletTransactions: (params?: string) => adminGet<any>(`admin/wallet-transactions${params ? `?${params}` : ''}`),
  withdrawals: (params?: string) => adminGet<any>(`admin/withdrawals${params ? `?${params}` : ''}`),
  reconcileWithdrawal: (id: string, body: { reason: string }) => adminPost<any>(`admin/withdrawals/${id}/reconcile`, body),
  reconcileStaleWithdrawals: (body: { reason: string }, params?: string) =>
    adminPost<any, typeof body>(`admin/withdrawals/reconcile-stale${params ? `?${params}` : ''}`, body),
  disputes: (params?: string) => adminGet<any>(`admin/disputes${params ? `?${params}` : ''}`),
  admins: (params?: string) => adminGet<any>(`admin/admins${params ? `?${params}` : ''}`),
  adminDetail: (id: string) => adminGet<any>(`admin/admins/${id}`),
  createProperty: (body: Record<string, unknown>) => adminPost<any, Record<string, unknown>>('admin/properties', body),
  createAdmin: (body: {
    fullName?: string;
    email: string;
    phoneNumber?: string | null;
    role: 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'OPERATION_ADMIN' | 'COMPLIANCE_ADMIN';
    reason: string;
  }) => adminPost<any, typeof body>('admin/admins', body),
  updateAdmin: (
    id: string,
    body: {
      fullName?: string;
      email?: string;
      phoneNumber?: string | null;
      role?: 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'OPERATION_ADMIN' | 'COMPLIANCE_ADMIN';
      reason: string;
    },
  ) => adminPatch<any, typeof body>(`admin/admins/${id}`, body),
  suspendAdmin: (id: string, body: { reason: string }) => adminPost<any, typeof body>(`admin/admins/${id}/suspend`, body),
  deactivateAdmin: (id: string, body: { reason: string }) =>
    adminPost<any, typeof body>(`admin/admins/${id}/deactivate`, body),
  fees: (params?: string) => adminGet<any>(`admin/fees${params ? `?${params}` : ''}`),
  coholds: (params?: string) => adminGet<any>(`admin/coholds${params ? `?${params}` : ''}`),
  activityLog: (params?: string) => adminGet<any>(`admin/activity-log${params ? `?${params}` : ''}`),
  ledgerReconciliation: () => adminGet<LedgerReconciliationReport>('admin/ledger/reconciliation'),
  distributionIncomeEvents: (params?: string) =>
    adminGet<any>(`admin/distributions/income-events${params ? `?${params}` : ''}`),
  distributionBatches: (params?: string) =>
    adminGet<any>(`admin/distributions/batches${params ? `?${params}` : ''}`),
  distributionBatchDetail: (id: string) => adminGet<any>(`admin/distributions/batches/${id}`),
  distributionBatchPreview: (id: string) => adminGet<any>(`admin/distributions/batches/${id}/preview`),
  approveDistributionBatch: (id: string) => adminPost<any>(`admin/distributions/batches/${id}/approve`),
  processDistributionBatch: (id: string, body?: { reference?: string }) =>
    adminPost<any, { reference?: string }>(`admin/distributions/batches/${id}/process`, body ?? {}),
  failedDistributionItems: (id: string) => adminGet<any>(`admin/distributions/batches/${id}/failed-items`),
  retryFailedDistributionItems: (id: string) => adminPost<any>(`admin/distributions/batches/${id}/retry-failed`),
  outbox: (params?: string) => adminGet<AdminOutboxEvent[]>(`admin/ops/outbox${params ? `?${params}` : ''}`),
  outboxDetail: (id: string) => adminGet<AdminOutboxEvent | null>(`admin/ops/outbox/${id}`),
  deadLetterOutbox: (params?: string) => adminGet<AdminOutboxEvent[]>(`admin/ops/dead-letter${params ? `?${params}` : ''}`),
  retryOutbox: (id: string) => adminPost<{ retried: boolean }>(`admin/ops/outbox/${id}/retry`),
  jobsRegistry: () => adminGet<AdminJobState[]>('admin/ops/jobs'),

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
  resolveSupportConversation: (id: string, body: { reason: string }) =>
    adminPost<any>(`admin/support/conversations/${id}/resolve`, body),
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
