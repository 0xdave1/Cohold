import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { adminMetricCardToneClass } from '@/components/admin/AdminMetricCard';
import {
  buildDashboardExceptionMetrics,
  buildFigmaDashboardSections,
  formatMetricDisplay,
} from '@/lib/admin/dashboard-metrics';
import {
  allAdminNavHrefs,
  flattenVisibleNavItems,
  isAdminNavActive,
  visibleAdminNavGroups,
} from '@/lib/admin/nav-config';

describe('Admin Figma design pass', () => {
  it('does not render fake placeholder dashboard values (no +20.1% demo trends)', () => {
    const sections = buildFigmaDashboardSections({
      totalUsers: 100,
      totalVerifiedUsers: 80,
      totalUnverifiedUsers: 20,
      activeListings: 5,
      pendingKyc: 2,
      openDisputes: 1,
      coholdRevenue: null,
      fractionalListings: null,
      landListings: null,
      ownAHomeListings: null,
      unsupported: { coholdRevenue: 'No revenue aggregate.' },
    } as Record<string, unknown>);

    const serialized = JSON.stringify(sections);
    expect(serialized).not.toMatch(/\+20\.1%/);
    expect(serialized).not.toMatch(/6,000,009/);
    expect(serialized).not.toMatch(/from last month/i);
  });

  it('unsupported metric renders "Not available"', () => {
    const sections = buildFigmaDashboardSections({
      coholdRevenue: null,
      unsupported: { coholdRevenue: 'Not exposed.' },
    } as Record<string, unknown>);
    const revenue = sections.operations.find((m) => m.key === 'revenue');
    expect(revenue?.kind).toBe('unsupported');
    expect(formatMetricDisplay(revenue!).primary).toBe('Not available');
  });

  it('missing currency totals render "Not available" instead of zero', () => {
    const sections = buildFigmaDashboardSections({
      totalUsers: 1,
      totalVerifiedUsers: 1,
    } as Record<string, unknown>);
    const ngn = sections.investmentsByCurrency.find((m) => m.key === 'inv-NGN');
    expect(formatMetricDisplay(ngn!).primary).toBe('Not available');
  });

  it('SUPER_ADMIN sees all grouped nav routes', () => {
    const groups = visibleAdminNavGroups('SUPER_ADMIN');
    const hrefs = flattenVisibleNavItems('SUPER_ADMIN').map((i) => i.href.split('#')[0]);
    const expected = allAdminNavHrefs();
    for (const href of expected) {
      expect(hrefs).toContain(href);
    }
    expect(groups.some((g) => g.id === 'finance')).toBe(true);
    expect(groups.some((g) => g.id === 'system')).toBe(true);
  });

  it('DATA_UPLOADER does not see finance or system nav groups', () => {
    const groups = visibleAdminNavGroups('DATA_UPLOADER');
    const ids = groups.map((g) => g.id);
    expect(ids).not.toContain('finance');
    expect(ids).not.toContain('system');
    const labels = flattenVisibleNavItems('DATA_UPLOADER').map((i) => i.label);
    expect(labels).not.toContain('Wallet transactions');
    expect(labels).not.toContain('Admin management');
    expect(labels).not.toContain('Ops / Outbox');
  });

  it('highlights active admin route (prefix match)', () => {
    expect(isAdminNavActive('/admin/users/abc', '/admin/users')).toBe(true);
    expect(isAdminNavActive('/admin/dashboard', '/admin/dashboard')).toBe(true);
    expect(isAdminNavActive('/admin/users', '/admin/verifications')).toBe(false);
    expect(isAdminNavActive('/admin/dashboard', '/admin/dashboard#ops-outbox', false)).toBe(true);
  });

  it('sidebar source keeps logout control (pinned footer)', () => {
    const src = readFileSync(join(process.cwd(), 'components/admin/Sidebar.tsx'), 'utf8');
    expect(src).toMatch(/Logout/);
    expect(src).toMatch(/border-t border-\[#DDD8D2\]/);
  });

  it('AdminMetricCard renders warning and danger styling for ops metrics', () => {
    const warning = buildDashboardExceptionMetrics({ pendingKyc: 3 } as Record<string, unknown>).find(
      (m) => m.key === 'pendingKyc',
    )!;
    const danger = buildDashboardExceptionMetrics({
      outbox: { deadLetter: 2 },
    } as Record<string, unknown>).find((m) => m.key === 'outboxDl')!;

    expect(warning.tone).toBe('attention');
    expect(danger.tone).toBe('critical');
    expect(adminMetricCardToneClass('warning')).toMatch(/amber/);
    expect(adminMetricCardToneClass('danger')).toMatch(/red/);
    expect(formatMetricDisplay(danger).primary).toMatch(/2/);
  });

  it('zero-count ops metrics use neutral tone (not fake success green)', () => {
    const rows = buildDashboardExceptionMetrics({
      outbox: { deadLetter: 0 },
      virtualAccounts: { failedOrRetryRequired: 0 },
    } as Record<string, unknown>);
    const dl = rows.find((m) => m.key === 'outboxDl');
    const va = rows.find((m) => m.key === 'vaFailed');
    expect(dl?.tone).toBe('neutral');
    expect(va?.tone).toBe('neutral');
  });
});
