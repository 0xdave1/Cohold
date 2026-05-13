import type { OnboardingChecklist } from '@/lib/hooks/use-onboarding-checklist';

export type DashboardTodoShortcut = {
  id: string;
  title: string;
  href: string;
};

/** Shown when checklist fails or is missing — no error UI, friendly defaults only. */
export const DEFAULT_DASHBOARD_TODO_SHORTCUTS: DashboardTodoShortcut[] = [
  { id: 'kyc', title: 'Complete your KYC', href: '/dashboard/kyc' },
  { id: 'fund', title: 'Fund your wallet', href: '/dashboard/wallet' },
  { id: 'browse', title: 'Browse properties', href: '/dashboard/properties' },
  { id: 'support', title: 'Contact support', href: '/dashboard/support' },
  { id: 'notifications', title: 'Check notifications', href: '/dashboard/notifications' },
];

const MAX_SHORTCUTS = 6;

function pushUnique(out: DashboardTodoShortcut[], item: DashboardTodoShortcut) {
  if (out.some((x) => x.href === item.href)) return;
  out.push(item);
}

function padFromDefaults(out: DashboardTodoShortcut[]) {
  for (const d of DEFAULT_DASHBOARD_TODO_SHORTCUTS) {
    if (out.length >= MAX_SHORTCUTS) break;
    pushUnique(out, d);
  }
}

/**
 * Builds Figma-style to-do shortcut cards from onboarding checklist.
 * On fetch failure or missing data, returns default shortcuts (no empty state).
 */
export function buildDashboardTodoShortcuts(
  checklist: OnboardingChecklist | undefined,
  opts: { isError: boolean },
): DashboardTodoShortcut[] {
  if (opts.isError || !checklist) {
    return DEFAULT_DASHBOARD_TODO_SHORTCUTS.slice();
  }

  const out: DashboardTodoShortcut[] = [];

  if (!checklist.emailVerified) {
    pushUnique(out, { id: 'email', title: 'Verify your email', href: '/dashboard/account' });
  }
  if (!checklist.profileBasicsComplete) {
    pushUnique(out, { id: 'profile', title: 'Complete your profile', href: '/onboarding/personal-details' });
  }
  if (!checklist.kycVerified) {
    pushUnique(out, { id: 'kyc', title: 'Complete your KYC', href: '/dashboard/kyc' });
  }
  if (!checklist.virtualAccountActive) {
    pushUnique(out, { id: 'va', title: 'Set up bank funding', href: '/dashboard/wallet' });
  }
  if (!checklist.walletFunded) {
    pushUnique(out, { id: 'fund', title: 'Fund your wallet', href: '/dashboard/wallet' });
  }
  if (!checklist.firstInvestmentCompleted) {
    pushUnique(out, { id: 'browse', title: 'Browse properties', href: '/dashboard/properties' });
  }

  padFromDefaults(out);

  if (out.length === 0) {
    return DEFAULT_DASHBOARD_TODO_SHORTCUTS.slice();
  }

  return out.slice(0, MAX_SHORTCUTS);
}
