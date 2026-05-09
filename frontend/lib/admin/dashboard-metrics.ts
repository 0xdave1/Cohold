/**
 * Map backend dashboard overview + ops summary to UI-safe metric values.
 * Never substitute fake zero for null / unsupported.
 */

export type MetricKind = 'count' | 'money' | 'text' | 'unsupported';

export type DashboardMetric = {
  key: string;
  label: string;
  kind: MetricKind;
  /** Present only when metric is supported and numeric/string value exists */
  value?: number | string;
  unsupportedReason?: string;
  /** healthy | attention | critical */
  tone?: 'healthy' | 'attention' | 'critical';
};

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

export function buildDashboardExceptionMetrics(overview: Record<string, unknown> | null | undefined): DashboardMetric[] {
  if (!overview) return [];
  const w = overview.withdrawals as Record<string, unknown> | undefined;
  const va = overview.virtualAccounts as Record<string, unknown> | undefined;
  const out = overview.outbox as Record<string, unknown> | undefined;
  const dist = overview.distributions as Record<string, unknown> | undefined;
  const ledgerN = num(overview.ledgerReconciliationMismatchCount);

  const recon = w ? num(w.reconciliationRequired) : undefined;
  const vaFail = va ? num(va.failedOrRetryRequired) : undefined;
  const dl = out ? num(out.deadLetter) : undefined;
  const partial = dist ? num(dist.partiallyFailed) : undefined;

  const rows: DashboardMetric[] = [
    {
      key: 'pendingKyc',
      label: 'Pending KYC',
      kind: 'count',
      value: num(overview.pendingKyc),
      tone: (num(overview.pendingKyc) ?? 0) > 0 ? 'attention' : 'healthy',
    },
    {
      key: 'withdrawalRecon',
      label: 'Withdrawals — reconciliation required',
      kind: 'count',
      value: recon,
      tone: (recon ?? 0) > 0 ? 'critical' : 'healthy',
    },
    {
      key: 'vaFailed',
      label: 'Virtual accounts — failed / retry required',
      kind: 'count',
      value: vaFail,
      tone: (vaFail ?? 0) > 0 ? 'critical' : 'healthy',
    },
    {
      key: 'outboxDl',
      label: 'Outbox — dead-letter',
      kind: 'count',
      value: dl,
      tone: (dl ?? 0) > 0 ? 'critical' : 'healthy',
    },
    {
      key: 'distPartial',
      label: 'Distributions — partially failed batches',
      kind: 'count',
      value: partial,
      tone: (partial ?? 0) > 0 ? 'critical' : 'healthy',
    },
    {
      key: 'ledgerMismatch',
      label: 'Ledger reconciliation signals',
      kind: 'count',
      value: ledgerN,
      tone: (ledgerN ?? 0) > 0 ? 'critical' : 'healthy',
    },
  ];
  return rows;
}

export function formatMetricDisplay(m: DashboardMetric): { primary: string; sub?: string } {
  if (m.kind === 'unsupported') {
    return { primary: 'Not available', sub: m.unsupportedReason };
  }
  if (m.value === undefined || m.value === null) {
    return { primary: 'Not available' };
  }
  if (m.kind === 'count') {
    return { primary: new Intl.NumberFormat('en-NG').format(Number(m.value)) };
  }
  if (m.kind === 'money') {
    return { primary: String(m.value) };
  }
  return { primary: String(m.value) };
}

/** Primary dashboard cards from `GET admin/dashboard/overview` (truthful — no fake zeros for null metrics). */
export function buildPrimaryDashboardMetrics(overview: Record<string, unknown> | null | undefined): DashboardMetric[] {
  if (!overview) return [];
  const unsupported = overview.unsupported as Record<string, string> | undefined;
  const totalCoholds = overview.totalCoholds;
  const coholdRevenue = overview.coholdRevenue;
  const frac = overview.fractionalListings;
  const land = overview.landListings;
  const oah = overview.ownAHomeListings;

  const rows: DashboardMetric[] = [
    { key: 'users', label: 'Total users', kind: 'count', value: num(overview.totalUsers), tone: 'healthy' },
    { key: 'verified', label: 'Verified users', kind: 'count', value: num(overview.totalVerifiedUsers), tone: 'healthy' },
    { key: 'pendingKyc', label: 'Pending KYC', kind: 'count', value: num(overview.pendingKyc), tone: 'attention' },
    { key: 'kycReview', label: 'KYC failed / requires review', kind: 'count', value: num(overview.rejectedOrReviewKyc), tone: 'attention' },
    { key: 'frozen', label: 'Frozen users', kind: 'count', value: num(overview.frozenUsers), tone: 'attention' },
    { key: 'invCount', label: 'Investments (count)', kind: 'count', value: num(overview.totalInvestmentsCount), tone: 'healthy' },
    {
      key: 'invAmt',
      label: 'Total invested (sum)',
      kind: 'money',
      value: overview.totalInvestedAmount != null ? String(overview.totalInvestedAmount) : undefined,
      tone: 'healthy',
    },
    {
      key: 'fundVol',
      label: 'Wallet funding volume (completed top-ups)',
      kind: 'money',
      value: overview.walletFundingVolume != null ? String(overview.walletFundingVolume) : undefined,
      tone: 'healthy',
    },
    { key: 'activeProp', label: 'Active properties (published)', kind: 'count', value: num(overview.activeListings), tone: 'healthy' },
    { key: 'draftProp', label: 'Draft / pending listings', kind: 'count', value: num(overview.pendingListings), tone: 'attention' },
    {
      key: 'openSupport',
      label: 'Open support conversations',
      kind: 'count',
      value: num(overview.supportOpenConversations),
      tone: 'attention',
    },
    {
      key: 'openDisputes',
      label: 'Open dispute-flagged conversations',
      kind: 'count',
      value: num(overview.openDisputes),
      tone: (num(overview.openDisputes) ?? 0) > 0 ? 'critical' : 'healthy',
    },
  ];

  rows.push(
    totalCoholds === null || totalCoholds === undefined
      ? {
          key: 'coholds',
          label: 'Total coholds',
          kind: 'unsupported',
          unsupportedReason: unsupported?.totalCoholds ?? 'Not tracked by this API.',
        }
      : { key: 'coholds', label: 'Total coholds', kind: 'count', value: num(totalCoholds), tone: 'healthy' },
  );

  rows.push(
    coholdRevenue === null || coholdRevenue === undefined
      ? {
          key: 'revenue',
          label: 'Platform revenue',
          kind: 'unsupported',
          unsupportedReason: unsupported?.coholdRevenue ?? 'Not exposed as a durable metric.',
        }
      : { key: 'revenue', label: 'Platform revenue', kind: 'money', value: String(coholdRevenue), tone: 'healthy' },
  );

  if (frac === null && land === null && oah === null) {
    rows.push({
      key: 'listingTypes',
      label: 'Listings by type',
      kind: 'unsupported',
      unsupportedReason: unsupported?.listingTypeBreakdown ?? 'Listing taxonomy not modeled.',
    });
  } else {
    if (frac != null) rows.push({ key: 'frac', label: 'Fractional listings', kind: 'count', value: num(frac), tone: 'healthy' });
    if (land != null) rows.push({ key: 'land', label: 'Land listings', kind: 'count', value: num(land), tone: 'healthy' });
    if (oah != null) rows.push({ key: 'oah', label: 'Own-a-home listings', kind: 'count', value: num(oah), tone: 'healthy' });
  }

  return rows;
}

export function mergeOpsSummaryIntoExceptions(
  overviewMetrics: DashboardMetric[],
  ops: Record<string, unknown> | null | undefined,
): DashboardMetric[] {
  if (!ops) return overviewMetrics;
  const va = ops.virtualAccounts as Record<string, unknown> | undefined;
  const unmatched = va ? num(va.unmatchedDeposits) : undefined;
  if (unmatched === undefined) return overviewMetrics;
  const copy = [...overviewMetrics];
  copy.push({
    key: 'unmatchedVaDeposits',
    label: 'Unmatched virtual account deposits (rows)',
    kind: 'count',
    value: unmatched,
    tone: unmatched > 0 ? 'critical' : 'healthy',
  });
  return copy;
}
