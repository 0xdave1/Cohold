/**
 * Issue 12: lightweight route-readiness map for QA / audits.
 * Each entry describes expected UX states (not runtime guarantees).
 */
export type RouteReadinessEntry = {
  path: string;
  audience: 'user' | 'admin' | 'public';
  loading: string;
  empty: string;
  error: string;
  unauthorized?: string;
  notes?: string;
};

export const ROUTE_READINESS: RouteReadinessEntry[] = [
  {
    path: '/login',
    audience: 'public',
    loading: 'Form skeleton acceptable',
    empty: 'N/A',
    error: 'Issue 9 mapped auth errors',
    notes: 'No wallet balances on this route',
  },
  {
    path: '/dashboard/home',
    audience: 'user',
    loading: 'Wallet + summary skeletons',
    empty: 'Listings / investments empty states',
    error: 'Mapped API errors; summary section may partial-fail independently',
    unauthorized: 'OnboardingGuard → login',
    notes: 'Dashboard summary + checklist are backend-derived (Issue 12)',
  },
  {
    path: '/dashboard/wallet',
    audience: 'user',
    loading: 'Balance skeleton',
    empty: 'N/A',
    error: 'Verify + funding errors mapped (financial-errors)',
    unauthorized: 'KYC gate for funding UI',
  },
  {
    path: '/dashboard/notifications',
    audience: 'user',
    loading: 'Spinner',
    empty: 'EmptyState',
    error: 'mapApiError (Issue 9)',
    notes: 'WebSocket fallback banner + manual refresh',
  },
  {
    path: '/dashboard/support',
    audience: 'user',
    loading: 'Conversation list skeleton',
    empty: 'No conversations',
    error: 'Support API failure → safe message + contact fallback where implemented',
  },
  {
    path: '/admin/launch-readiness',
    audience: 'admin',
    loading: 'Section skeletons',
    empty: 'N/A',
    error: 'mapApiError',
    unauthorized: '403 if role lacks ops visibility',
    notes: 'Issue 7 shown only as MANUAL_CHECK_REQUIRED — never certified here',
  },
];
