import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isValidWalletFundingNairaInput,
  normalizeAmountNairaInput,
  walletFundingAmountError,
} from './normalize-amount-naira';

const readRel = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8');

describe('wallet funding Naira contract (frontend)', () => {
  it('normalizes comma-formatted Naira for submit', () => {
    expect(normalizeAmountNairaInput('1,500.50')).toBe('1500.50');
    expect(isValidWalletFundingNairaInput('1,500.50')).toBe(true);
  });

  it('rejects invalid decimal precision', () => {
    expect(walletFundingAmountError('1500.555')).toMatch(/decimal/i);
  });

  it('use-wallet initialize sends amountNaira only', () => {
    const src = readRel('lib/hooks/use-wallet.ts');
    expect(src).toContain('amountNaira');
    expect(src).toMatch(/post<[^>]+>\([\s\S]*amountNaira: body\.amountNaira/);
    expect(src).not.toMatch(/initializeWalletPayment[\s\S]*currency:\s*['"]NGN['"]/);
  });

  it('FundWalletCard does not send currency or kobo', () => {
    const card = readRel('components/wallet/FundWalletCard.tsx');
    expect(card).toContain('amountNaira');
    expect(card).not.toContain('currency');
    expect(card).not.toContain('kobo');
    expect(card).not.toMatch(/Decimal\(/);
  });

  it('wallet callback page does not optimistically credit balance', () => {
    const page = readRel('app/dashboard/wallet/page.tsx');
    expect(page).toContain('Payment submitted. Confirming wallet funding');
    expect(page).toContain("get('payment') === 'callback'");
    expect(page).not.toContain('setQueryData');
    expect(page).toMatch(/useVerifyWalletPayment/);
    expect(page).toMatch(/refetchBalances/);
  });
});
