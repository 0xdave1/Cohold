import { describe, expect, it } from 'vitest';
import { deriveJobHealth, safeOutboxPayloadPreview, shouldPauseOpsPolling } from '@/lib/admin/ops-visibility';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { AdminJobState, AdminOutboxEvent } from '@/lib/admin/api';

function outbox(overrides: Partial<AdminOutboxEvent>): AdminOutboxEvent {
  return {
    id: 'o1',
    type: 'NOTIFICATION_DELIVERY',
    aggregateType: 'Notification',
    aggregateId: 'n1',
    idempotencyKey: 'k1',
    status: 'DEAD_LETTER',
    priority: 1,
    attempts: 2,
    maxAttempts: 3,
    nextAttemptAt: new Date().toISOString(),
    lockedAt: null,
    lockedBy: null,
    payload: { token: 'secret' },
    sanitizedPayload: undefined,
    lastError: null,
    lastErrorAt: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function job(overrides: Partial<AdminJobState>): AdminJobState {
  return {
    name: 'outbox-worker',
    enabled: true,
    lastRunAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastError: null,
    nextRunAt: null,
    ...overrides,
  };
}

describe('safeOutboxPayloadPreview', () => {
  it('hides raw payload when sanitized payload is missing', () => {
    expect(safeOutboxPayloadPreview(outbox({ payload: { bvn: '12345678901' }, sanitizedPayload: undefined }))).toBeNull();
  });

  it('renders sanitized payload safely', () => {
    const preview = safeOutboxPayloadPreview(
      outbox({ sanitizedPayload: { reason: 'masked', token: 'Bearer abc.def' } }),
    );
    expect(preview).toContain('masked');
    expect(preview).not.toContain('abc.def');
  });
});

describe('deriveJobHealth', () => {
  it('returns unknown for null/unknown runs', () => {
    expect(deriveJobHealth(job({}))).toBe('unknown');
  });
});

describe('shouldPauseOpsPolling', () => {
  function ax(status: number): AxiosError {
    const config = { url: '/admin/ops/outbox' } as InternalAxiosRequestConfig;
    return new AxiosError('x', AxiosError.ERR_BAD_REQUEST, config, {}, {
      data: { error: 'x' },
      status,
      statusText: 'Err',
      headers: {},
      config,
    });
  }

  it('pauses polling for auth/rate-limit errors', () => {
    expect(shouldPauseOpsPolling(ax(401))).toBe(true);
    expect(shouldPauseOpsPolling(ax(403))).toBe(true);
    expect(shouldPauseOpsPolling(ax(429))).toBe(true);
  });
});
