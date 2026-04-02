const BASE = '/api/admin/proxy';

async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json?.error;
    const msg =
      typeof err === 'string'
        ? err
        : typeof err?.message === 'string'
          ? err.message
          : typeof json?.message === 'string'
            ? json.message
            : typeof json?.data?.message === 'string'
              ? json.data.message
              : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json?.data !== undefined ? json.data : json;
}

export const adminApi = {
  dashboard: () => adminFetch<any>('admin/dashboard/overview'),
  users: (params?: string) => adminFetch<any>(`admin/users${params ? `?${params}` : ''}`),
  userDetail: (id: string) => adminFetch<any>(`admin/users/${id}`),
  userTransactions: (id: string, params?: string) => adminFetch<any>(`admin/users/${id}/transactions${params ? `?${params}` : ''}`),
  suspendUser: (id: string) => adminFetch<any>(`admin/users/${id}/suspend`, { method: 'POST' }),
  deleteUser: (id: string) => adminFetch<any>(`admin/users/${id}`, { method: 'DELETE' }),
  verifications: (params?: string) => adminFetch<any>(`admin/verifications${params ? `?${params}` : ''}`),
  approveKyc: (id: string) => adminFetch<any>(`admin/verifications/${id}/approve`, { method: 'POST' }),
  rejectKyc: (id: string) => adminFetch<any>(`admin/verifications/${id}/reject`, { method: 'POST' }),
  properties: (params?: string) => adminFetch<any>(`admin/properties${params ? `?${params}` : ''}`),
  propertyDetail: (id: string) => adminFetch<any>(`admin/properties/${id}`),
  propertyInvestors: (id: string, params?: string) => adminFetch<any>(`admin/properties/${id}/investors${params ? `?${params}` : ''}`),
  closeProperty: (id: string) => adminFetch<any>(`admin/properties/${id}/close`, { method: 'POST' }),
  deleteProperty: (id: string) => adminFetch<any>(`admin/properties/${id}`, { method: 'DELETE' }),
  walletTransactions: (params?: string) => adminFetch<any>(`admin/wallet-transactions${params ? `?${params}` : ''}`),
  disputes: (params?: string) => adminFetch<any>(`admin/disputes${params ? `?${params}` : ''}`),
  admins: (params?: string) => adminFetch<any>(`admin/admins${params ? `?${params}` : ''}`),
  adminDetail: (id: string) => adminFetch<any>(`admin/admins/${id}`),
  createAdmin: (body: {
    fullName: string;
    email: string;
    phoneNumber?: string | null;
    role: 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'OPERATION_ADMIN' | 'COMPLIANCE_ADMIN';
  }) => adminFetch<any>('admin/admins', { method: 'POST', body: JSON.stringify(body) }),
  updateAdmin: (
    id: string,
    body: {
      fullName?: string;
      email?: string;
      phoneNumber?: string | null;
      role?: 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'OPERATION_ADMIN' | 'COMPLIANCE_ADMIN';
    },
  ) => adminFetch<any>(`admin/admins/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  suspendAdmin: (id: string) => adminFetch<any>(`admin/admins/${id}/suspend`, { method: 'POST' }),
  deactivateAdmin: (id: string) => adminFetch<any>(`admin/admins/${id}/deactivate`, { method: 'POST' }),
  fees: (params?: string) => adminFetch<any>(`admin/fees${params ? `?${params}` : ''}`),
  coholds: (params?: string) => adminFetch<any>(`admin/coholds${params ? `?${params}` : ''}`),
  activityLog: (params?: string) => adminFetch<any>(`admin/activity-log${params ? `?${params}` : ''}`),

  // Support inbox
  supportConversations: (params?: string) => adminFetch<any>(`admin/support/conversations${params ? `?${params}` : ''}`),
  supportConversation: (id: string) => adminFetch<any>(`admin/support/conversations/${id}`),
  supportMessages: (id: string, params?: string) =>
    adminFetch<any>(`admin/support/conversations/${id}/messages${params ? `?${params}` : ''}`),
  sendSupportMessage: (id: string, body: any) =>
    adminFetch<any>(`admin/support/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify(body) }),
  addSupportInternalNote: (id: string, body: any) =>
    adminFetch<any>(`admin/support/conversations/${id}/internal-notes`, { method: 'POST', body: JSON.stringify(body) }),
  assignSupportConversation: (id: string, body?: any) =>
    adminFetch<any>(`admin/support/conversations/${id}/assign`, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  resolveSupportConversation: (id: string) =>
    adminFetch<any>(`admin/support/conversations/${id}/resolve`, { method: 'POST' }),
  setSupportPresence: (body: { isOnline: boolean }) =>
    adminFetch<any>('admin/support/presence', { method: 'POST', body: JSON.stringify(body) }),
  onlineSupportAgents: () => adminFetch<any>('admin/support/presence/online'),
  presignSupportAttachment: (body: any) =>
    adminFetch<any>('admin/support/attachments/presign', { method: 'POST', body: JSON.stringify(body) }),
};
