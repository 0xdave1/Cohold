import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertProductionPublicApiUrl } from '@/lib/env/public-api-env';

const readRel = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8');

describe('Issue 9 frontend security posture', () => {
  it('next.config sets core security headers', () => {
    const src = readRel('next.config.js');
    expect(src).toContain('X-Content-Type-Options');
    expect(src).toContain('nosniff');
    expect(src).toContain('Referrer-Policy');
    expect(src).toContain('X-Frame-Options');
    expect(src).toContain('Permissions-Policy');
    expect(src).toContain('Content-Security-Policy');
  });

  it('providers disable mutation retry and use axios retry guard', () => {
    const src = readRel('lib/providers.tsx');
    expect(src).toContain('axiosQueryRetryPredicate');
    expect(src).toContain('mutations:');
    expect(src).toContain('retry: false');
  });

  it('API errors module re-exports security mapper', () => {
    const src = readRel('lib/api/errors.ts');
    expect(src).toContain('mapApiError');
    expect(src).toContain('sanitizeBackendMessage');
  });

  it('investment flow does not reference legacy top-up path', () => {
    const invest = readRel('lib/hooks/use-investment-mutations.ts');
    expect(invest).not.toContain('/wallets/top-up');
  });

  it('auth store documents memory-only JWT (no localStorage refresh)', () => {
    const src = readRel('stores/auth.store.ts');
    expect(src).toContain('never localStorage');
    expect(src).not.toMatch(/localStorage.*refresh/i);
  });

  it('production public API URL validation rejects localhost', () => {
    const prev = process.env.ALLOW_INSECURE_PUBLIC_API_URL;
    delete process.env.ALLOW_INSECURE_PUBLIC_API_URL;
    expect(() => assertProductionPublicApiUrl('http://localhost:4000/api/v1')).toThrow('localhost');
    process.env.ALLOW_INSECURE_PUBLIC_API_URL = prev;
  });

  it('production public API URL validation rejects non-https URL', () => {
    const prev = process.env.ALLOW_INSECURE_PUBLIC_API_URL;
    delete process.env.ALLOW_INSECURE_PUBLIC_API_URL;
    expect(() => assertProductionPublicApiUrl('http://api.example.com/api/v1')).toThrow('https');
    process.env.ALLOW_INSECURE_PUBLIC_API_URL = prev;
  });

  it('production public API URL validation accepts https URL', () => {
    const prev = process.env.ALLOW_INSECURE_PUBLIC_API_URL;
    delete process.env.ALLOW_INSECURE_PUBLIC_API_URL;
    expect(() => assertProductionPublicApiUrl('https://api.example.com/api/v1')).not.toThrow();
    process.env.ALLOW_INSECURE_PUBLIC_API_URL = prev;
  });

  it('insecure override allows non-https only when explicitly set', () => {
    const prev = process.env.ALLOW_INSECURE_PUBLIC_API_URL;
    process.env.ALLOW_INSECURE_PUBLIC_API_URL = 'true';
    expect(() => assertProductionPublicApiUrl('http://api.example.com/api/v1')).not.toThrow();
    expect(() => assertProductionPublicApiUrl('http://localhost:4000/api/v1')).not.toThrow();
    process.env.ALLOW_INSECURE_PUBLIC_API_URL = prev;
  });

  it('admin proxy route sanitizes errors via security-errors', () => {
    const src = readRel('app/api/admin/proxy/[...path]/route.ts');
    expect(src).toContain('sanitizeBackendMessage');
    expect(src).toContain('extractUpstreamErrorMessage');
  });

  it('sensitive pages avoid raw console.log', () => {
    const ws = readRel('lib/hooks/use-websocket.ts');
    expect(ws).not.toContain('console.log');
    expect(ws).toContain('safeDebugLog');
  });
});
