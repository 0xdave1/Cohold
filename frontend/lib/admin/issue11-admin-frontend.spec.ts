import { describe, expect, it, vi } from 'vitest';
import { buildPrimaryDashboardMetrics, formatMetricDisplay } from '@/lib/admin/dashboard-metrics';
import { canProcessDistribution, canViewVirtualAccountOps } from '@/lib/admin/permissions';
import { sanitizeObjectForDisplay } from '@/lib/admin/mask';
import { mapApiError } from '@/lib/api/security-errors';
import axios from 'axios';

describe('Issue 11 admin frontend', () => {
  it('does not show fake zero for unsupported cohold revenue — uses unsupported kind', () => {
    const rows = buildPrimaryDashboardMetrics({
      totalUsers: 10,
      totalVerifiedUsers: 5,
      totalUnverifiedUsers: 5,
      pendingKyc: 1,
      rejectedOrReviewKyc: 0,
      frozenUsers: 0,
      totalInvestmentsCount: 3,
      totalInvestedAmount: '100',
      walletFundingVolume: '50',
      activeListings: 2,
      pendingListings: 1,
      supportOpenConversations: 0,
      openDisputes: 0,
      totalCoholds: null,
      coholdRevenue: null,
      fractionalListings: null,
      landListings: null,
      ownAHomeListings: null,
      unsupported: {
        totalCoholds: 'No model.',
        coholdRevenue: 'No revenue aggregate.',
        listingTypeBreakdown: 'N/A',
      },
    } as Record<string, unknown>);
    const revenue = rows.find((r) => r.key === 'revenue');
    expect(revenue?.kind).toBe('unsupported');
    const { primary } = formatMetricDisplay(revenue!);
    expect(primary).toBe('Not available');
  });

  it('openDisputes from backend renders as numeric when present', () => {
    const rows = buildPrimaryDashboardMetrics({
      openDisputes: 4,
    } as Record<string, unknown>);
    const d = rows.find((r) => r.key === 'openDisputes');
    expect(formatMetricDisplay(d!).primary).toMatch(/4/);
  });

  it('canProcessDistribution is false for DATA_UPLOADER', () => {
    expect(canProcessDistribution('DATA_UPLOADER')).toBe(false);
    expect(canProcessDistribution('APPROVER')).toBe(true);
  });

  it('canViewVirtualAccountOps is false for DATA_UPLOADER', () => {
    expect(canViewVirtualAccountOps('DATA_UPLOADER')).toBe(false);
    expect(canViewVirtualAccountOps('COMPLIANCE_ADMIN')).toBe(true);
  });

  it('403 maps to permission-oriented copy', () => {
    const spy = vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    try {
      const m = mapApiError({ response: { status: 403, data: {} } });
      expect(m.kind).toBe('forbidden');
      expect(m.message.toLowerCase()).toContain('permission');
    } finally {
      spy.mockRestore();
    }
  });

  it('sanitizeObjectForDisplay redacts nested payload and long digit strings', () => {
    const out = sanitizeObjectForDisplay({
      payload: { card: '4111111111111111' },
      nested: { token: 'abc' },
    }) as Record<string, unknown>;
    expect(out.payload).toBe('[redacted]');
    expect(out.nested).toEqual({ token: '[redacted]' });
  });
});
