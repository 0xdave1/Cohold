import { describe, expect, it } from 'vitest';
import {
  parseTransactionStatus,
  transactionStatusLabel,
  transactionStatusTone,
} from './transaction-status';

describe('transaction-status (Issue 3)', () => {
  it('treats RECONCILIATION_REQUIRED as ops-needed, not success or failure', () => {
    expect(transactionStatusTone('RECONCILIATION_REQUIRED')).toBe('ops');
    expect(transactionStatusTone('COMPLETED')).toBe('success');
    expect(transactionStatusTone('FAILED')).toBe('failure');
    expect(transactionStatusLabel('RECONCILIATION_REQUIRED')).toContain('reconciliation');
  });

  it('maps POSTED same as settled success tone', () => {
    expect(transactionStatusTone('POSTED')).toBe('success');
    expect(transactionStatusLabel('POSTED')).toBe('Posted');
  });

  it('unknown API status parses to UNKNOWN and renders neutral', () => {
    expect(parseTransactionStatus('FUTURE_LEG_STATUS')).toBe('UNKNOWN');
    expect(transactionStatusTone('UNKNOWN')).toBe('neutral');
    expect(transactionStatusLabel('UNKNOWN')).toContain('Unknown');
  });
});
