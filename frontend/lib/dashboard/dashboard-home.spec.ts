import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRel = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8');

describe('dashboard home UX', () => {
  it('does not render internal Issue 12 system copy', () => {
    const home = readRel('app/dashboard/home/page.tsx');
    expect(home).not.toMatch(/Overview \(from server\)|Onboarding checklist unavailable|Summary unavailable|Connect to the server/i);
    expect(home).not.toMatch(/from server|Authorization still follows/i);
  });

  it('wires checklist and summary hooks with Figma-style to-dos', () => {
    const home = readRel('app/dashboard/home/page.tsx');
    expect(home).toContain('useDashboardSummary');
    expect(home).toContain('useOnboardingChecklist');
    expect(home).toContain('DashboardTodoShortcuts');
    expect(home).toContain('investmentSummaryAside');
  });
});

describe('DashboardHeaderActions', () => {
  it('uses notification unread query for badge (real count)', () => {
    const src = readRel('components/dashboard/DashboardHeaderActions.tsx');
    expect(src).toContain('useUnreadNotificationCount');
  });
});
