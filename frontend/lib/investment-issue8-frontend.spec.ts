import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRel = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8');

describe('Issue 8 returns/distribution frontend integrity', () => {
  it('labels annualYield as projected and keeps risk disclosures', () => {
    const src = readRel('app/dashboard/properties/[id]/page.tsx');
    expect(src).toContain('Projected annual yield');
    expect(src).toContain('expectedReturnDisclosure');
    expect(src).toContain('riskDisclosure');
  });

  it('contains no guaranteed ROI language in key investment pages', () => {
    const props = readRel('app/dashboard/properties/page.tsx').toLowerCase();
    const portfolio = readRel('app/dashboard/portfolio/[id]/page.tsx').toLowerCase();
    const investments = readRel('app/dashboard/investments/page.tsx').toLowerCase();
    expect(props).not.toContain('guaranteed roi');
    expect(portfolio).not.toContain('guaranteed roi');
    expect(investments).not.toContain('guaranteed');
  });

  it('shows paid distribution as backend status mapping only', () => {
    const status = readRel('lib/distributions/status.ts');
    expect(status).toContain("if (s === 'POSTED' || s === 'COMPLETED') return 'POSTED'");
    expect(status).toContain("if (status === 'POSTED') return 'Paid'");
  });

  it('does not optimistically write wallet/distribution balances', () => {
    const walletHook = readRel('lib/hooks/use-wallet.ts');
    const distHook = readRel('lib/hooks/use-distributions.ts');
    expect(walletHook).not.toContain('setQueryData');
    expect(distHook).not.toContain('setQueryData');
  });

  it('renders distribution failures and unknown statuses neutrally', () => {
    const status = readRel('lib/distributions/status.ts');
    expect(status).toContain("if (status === 'FAILED') return 'Failed'");
    expect(status).toContain("if (status === 'REVERSED') return 'Reversed'");
    expect(status).toContain("return 'Unknown'");
  });

  it('adds admin distribution visibility panel', () => {
    const adminPage = readRel('app/admin/(panel)/distributions/page.tsx');
    expect(adminPage).toContain('Income and distributions');
    expect(adminPage).toContain('Distribution batches');
    expect(adminPage).toContain('Retry failed');
  });

  it('maps distribution-related backend errors to explicit user messages', () => {
    const errors = readRel('lib/finance/financial-errors.ts');
    expect(errors).toContain('income event is missing or not approved');
    expect(errors).toContain('partial failures');
    expect(errors).toContain('property income wallet balance is insufficient');
  });
});

