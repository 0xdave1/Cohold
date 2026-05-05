import { describe, expect, it } from 'vitest';
import { buildAdminProxyUpstreamHeaders } from '@/lib/admin-proxy-upstream';

describe('buildAdminProxyUpstreamHeaders', () => {
  it('forwards CSRF for unsafe methods when csrf cookie value present', () => {
    const h = buildAdminProxyUpstreamHeaders({
      cookieHeader: 'cohold_admin_refresh=x',
      method: 'POST',
      csrfCookieValue: 'csrf-val',
      contentType: 'application/json',
    });
    expect(h.Cookie).toContain('cohold_admin_refresh');
    expect(h['X-CSRF-Token']).toBe('csrf-val');
    expect(h['Content-Type']).toBe('application/json');
  });

  it('does not attach CSRF for GET', () => {
    const h = buildAdminProxyUpstreamHeaders({
      cookieHeader: 'cohold_admin_refresh=x',
      method: 'GET',
      csrfCookieValue: 'csrf-val',
      contentType: null,
    });
    expect(h['X-CSRF-Token']).toBeUndefined();
  });
});
