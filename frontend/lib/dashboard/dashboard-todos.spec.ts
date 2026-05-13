import { describe, expect, it } from 'vitest';
import { buildDashboardTodoShortcuts, DEFAULT_DASHBOARD_TODO_SHORTCUTS } from './dashboard-todos';

const completeChecklist = {
  emailVerified: true,
  kycSubmitted: true,
  kycVerified: true,
  virtualAccountActive: true,
  walletFunded: true,
  firstInvestmentCompleted: true,
  profileBasicsComplete: true,
  profilePhotoPresent: true,
  onboardingFlagSetAt: '2020-01-01T00:00:00.000Z',
} as const;

describe('buildDashboardTodoShortcuts', () => {
  it('returns default shortcuts when checklist fetch failed', () => {
    const out = buildDashboardTodoShortcuts(undefined, { isError: true });
    expect(out.map((x) => x.title)).toEqual(DEFAULT_DASHBOARD_TODO_SHORTCUTS.map((x) => x.title));
  });

  it('returns default shortcuts when checklist is missing and not an error', () => {
    const out = buildDashboardTodoShortcuts(undefined, { isError: false });
    expect(out[0]?.title).toBe('Complete your KYC');
  });

  it('includes KYC shortcut when KYC is not verified', () => {
    const out = buildDashboardTodoShortcuts(
      { ...completeChecklist, kycVerified: false, kycSubmitted: false },
      { isError: false },
    );
    expect(out.some((x) => x.title === 'Complete your KYC' && x.href === '/dashboard/kyc')).toBe(true);
  });

  it('does not surface internal checklist copy', () => {
    const src = JSON.stringify(DEFAULT_DASHBOARD_TODO_SHORTCUTS);
    expect(src).not.toMatch(/from server|unavailable|Authorization/i);
  });
});
