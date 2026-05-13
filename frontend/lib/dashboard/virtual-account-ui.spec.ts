import { describe, expect, it } from 'vitest';
import { getVirtualAccountWalletNotice } from './virtual-account-ui';

describe('getVirtualAccountWalletNotice', () => {
  it('warns on FAILED and REQUIRES_RETRY', () => {
    expect(getVirtualAccountWalletNotice({ status: 'FAILED' })).toBeTruthy();
    expect(getVirtualAccountWalletNotice({ status: 'REQUIRES_RETRY' })).toBeTruthy();
  });

  it('returns null for ACTIVE', () => {
    expect(getVirtualAccountWalletNotice({ status: 'ACTIVE' })).toBeNull();
  });
});
