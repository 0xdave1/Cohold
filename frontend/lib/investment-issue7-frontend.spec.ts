import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRel = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8');

describe('Issue 7 investment frontend integrity', () => {
  it('removes hardcoded legal verification claim from listings', () => {
    const src = readRel('app/dashboard/properties/page.tsx');
    expect(src).not.toContain('Cof O Verified');
    expect(src).toContain('titleVerificationStatus');
    expect(src).toContain('resolveListingMode');
  });

  it('keeps investment purchase wallet-funded without direct checkout init', () => {
    const summary = readRel('app/dashboard/properties/[id]/invest/summary/page.tsx');
    const hook = readRel('lib/hooks/use-properties.ts');
    expect(summary).not.toContain('initializeInvestmentPayment');
    expect(hook).toContain("'/investments/fractional'");
  });

  it('does not use /wallets/top-up in investment flow', () => {
    const src = readRel('app/dashboard/properties/[id]/invest/page.tsx');
    expect(src).not.toContain('/wallets/top-up');
  });

  it('blocks invest submit when KYC is not yet allowed or sold out', () => {
    const src = readRel('app/dashboard/properties/[id]/invest/page.tsx');
    expect(src).toContain('Checking KYC…');
    expect(src).toContain('KYC verification required');
    expect(src).toContain('Offering sold out');
  });

  it('stores backend investment receipt before success screen', () => {
    const summary = readRel('app/dashboard/properties/[id]/invest/summary/page.tsx');
    const success = readRel('app/dashboard/properties/[id]/invest/success/page.tsx');
    expect(summary).toContain('saveInvestmentReceipt');
    expect(success).toContain('readInvestmentReceipt');
    expect(success).toContain('Ledger/reference');
  });

  it('avoids optimistic query writes for investment purchase', () => {
    const src = readRel('lib/hooks/use-properties.ts');
    expect(src).not.toContain('setQueryData');
    expect(src).toContain('invalidateInvestmentRelatedQueries');
  });

  it('uses honest sell wording, not secondary-market claim', () => {
    const src = readRel('app/dashboard/properties/[id]/sell/summary/page.tsx');
    expect(src).toContain('platform buyback flow');
    expect(src).toContain('not an open secondary market');
  });

  it('shows ownership-safe fallback when portfolio detail is inaccessible', () => {
    const src = readRel('app/dashboard/portfolio/[id]/page.tsx');
    expect(src).toContain('Investment not found or not accessible');
  });

  it('portfolio investment detail uses backend listingType via resolveListingMode', () => {
    const src = readRel('app/dashboard/portfolio/[id]/page.tsx');
    expect(src).toContain('resolveListingMode');
    expect(src).not.toContain('detectListingMode');
    expect(src).toContain('Buy shares');
    expect(src).toContain('Sell back to platform');
  });

  it('investments list tabs filter by resolveListingMode', () => {
    const src = readRel('app/dashboard/investments/page.tsx');
    expect(src).toContain('resolveListingMode');
    expect(src).not.toContain('detectListingMode');
  });

  it('shows projected return and risk disclosures', () => {
    const src = readRel('app/dashboard/properties/[id]/page.tsx');
    expect(src).toContain('expectedReturnDisclosure');
    expect(src).toContain('riskDisclosure');
  });
});
