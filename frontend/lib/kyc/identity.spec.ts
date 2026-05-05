import { maskSensitiveId } from '@/lib/kyc/identity';

describe('maskSensitiveId', () => {
  it('masks accidental raw identities before display', () => {
    expect(maskSensitiveId('12345678901')).toBe('*******8901');
    expect(maskSensitiveId('A1234567')).toBe('***4567');
  });

  it('keeps already-masked strings unchanged', () => {
    expect(maskSensitiveId('****1234')).toBe('****1234');
  });
});
