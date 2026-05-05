import { describe, expect, it } from 'vitest';
import { attachCsrfHeaderForUnsafeMethod } from '@/lib/api/attach-csrf-header';

describe('attachCsrfHeaderForUnsafeMethod', () => {
  it('does not attach CSRF for GET/HEAD/OPTIONS', () => {
    const h: Record<string, string> = {};
    attachCsrfHeaderForUnsafeMethod('GET', h, () => 'tok');
    attachCsrfHeaderForUnsafeMethod('head', h, () => 'tok');
    attachCsrfHeaderForUnsafeMethod('OPTIONS', h, () => 'tok');
    expect(h['X-CSRF-Token']).toBeUndefined();
  });

  it('attaches X-CSRF-Token from reader for unsafe methods when cookie exists', () => {
    const h: Record<string, string> = {};
    attachCsrfHeaderForUnsafeMethod('POST', h, () => 'abc123');
    expect(h['X-CSRF-Token']).toBe('abc123');
  });

  it('does not set header when reader returns undefined', () => {
    const h: Record<string, string> = {};
    attachCsrfHeaderForUnsafeMethod('PATCH', h, () => undefined);
    expect(h['X-CSRF-Token']).toBeUndefined();
  });
});
