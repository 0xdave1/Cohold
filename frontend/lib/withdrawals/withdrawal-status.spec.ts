import { describe, expect, it } from 'vitest';
import {
  adminWithdrawalListBadge,
  isWithdrawalNonTerminal,
  parseWithdrawalStatus,
  withdrawalTone,
  withdrawalStatusBadgeLabel,
} from './status';

describe('withdrawal status helpers', () => {
  it('parses known backend statuses', () => {
    expect(parseWithdrawalStatus('INITIATING')).toBe('INITIATING');
    expect(parseWithdrawalStatus('RECONCILIATION_REQUIRED')).toBe('RECONCILIATION_REQUIRED');
  });

  it('treats unknown API values as UNKNOWN (never as failed)', () => {
    expect(parseWithdrawalStatus('FUTURE_STATUS')).toBe('UNKNOWN');
    expect(withdrawalTone('UNKNOWN')).toBe('pending');
  });

  it('PROCESSING is non-terminal', () => {
    expect(isWithdrawalNonTerminal('PROCESSING')).toBe(true);
  });

  it('RECONCILIATION_REQUIRED is non-terminal', () => {
    expect(isWithdrawalNonTerminal('RECONCILIATION_REQUIRED')).toBe(true);
  });

  it('COMPLETED is terminal', () => {
    expect(isWithdrawalNonTerminal('COMPLETED')).toBe(false);
  });

  it('FAILED uses final badge wording', () => {
    expect(withdrawalStatusBadgeLabel('FAILED')).toContain('Failed');
  });

  it('PROCESSING is pending tone, not failure', () => {
    expect(withdrawalTone('PROCESSING')).toBe('pending');
    expect(withdrawalTone('RECONCILIATION_REQUIRED')).toBe('pending');
  });

  it('admin list treats persisted reconciliation conflict as critical ops, not ordinary status', () => {
    const row = { status: 'RECONCILIATION_REQUIRED', reconciliationConflict: true };
    const { label, badgeClass } = adminWithdrawalListBadge(row);
    expect(label).toContain('reconciliation conflict');
    expect(label).not.toBe(withdrawalStatusBadgeLabel('RECONCILIATION_REQUIRED'));
    expect(badgeClass).toContain('rose');
  });

  it('admin list without conflict uses normal status badge label', () => {
    const { label, badgeClass } = adminWithdrawalListBadge({
      status: 'FAILED',
      reconciliationConflict: false,
    });
    expect(label).toBe(withdrawalStatusBadgeLabel('FAILED'));
    expect(badgeClass).toBeNull();
  });
});
