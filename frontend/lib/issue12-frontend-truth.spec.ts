import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { unsupportedMetricHint, unsupportedMetricLabel } from './dashboard/unsupported-metric';
import { ROUTE_READINESS } from './dashboard/route-readiness';

const readRel = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8');

describe('Issue 12 frontend truthfulness', () => {
  it('unsupportedMetricLabel does not fake a numeric zero', () => {
    expect(unsupportedMetricLabel(null)).toBe('Not available');
    expect(unsupportedMetricLabel(undefined)).toBe('Not available');
    expect(unsupportedMetricLabel('12.5')).toBe('12.5');
  });

  it('unsupportedMetricHint passes through trimmed reason', () => {
    expect(unsupportedMetricHint('  x  ')).toBe('x');
    expect(unsupportedMetricHint('')).toBeUndefined();
  });

  it('route readiness map documents Issue 7 manual check on admin launch route', () => {
    const row = ROUTE_READINESS.find((r) => r.path === '/admin/launch-readiness');
    expect(row?.notes).toMatch(/Issue 7/i);
  });

  it('dashboard home wires Issue 12 hooks without legacy system cards', () => {
    const home = readRel('app/dashboard/home/page.tsx');
    expect(home).toContain('useDashboardSummary');
    expect(home).toContain('useOnboardingChecklist');
    expect(home).toContain('DashboardTodoShortcuts');
    expect(home).not.toMatch(/Overview \(from server\)|Onboarding checklist unavailable|Summary unavailable/i);
    expect(home).not.toContain('unsupportedMetricLabel');
  });

  it('invest success page does not promise certificates or PDFs', () => {
    const src = readRel('app/dashboard/properties/[id]/invest/success/page.tsx');
    expect(src.toLowerCase()).not.toContain('certificate generation coming soon');
    expect(src).toMatch(/not a legal certificate|not a land title/i);
    expect(src).toMatch(/pdf/i);
  });

  it('admin launch readiness page surfaces Issue 7 manual blocker', () => {
    const src = readRel('app/admin/(panel)/launch-readiness/page.tsx');
    expect(src).toContain('MANUAL_CHECK_REQUIRED');
    expect(src).toContain('issue7InvestmentConcurrency');
    expect(src).not.toContain('Production certified');
  });

  it('referrals page does not default earnings to zero', () => {
    const src = readRel('app/dashboard/account/referrals/page.tsx');
    expect(src).not.toMatch(/earnings\s*\?\?\s*['"]0['"]/);
    expect(src).toContain('ledger-backed');
  });
});
