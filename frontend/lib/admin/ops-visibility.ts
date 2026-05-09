import type { AdminJobState, AdminOutboxEvent } from '@/lib/admin/api';
import { mapApiError } from '@/lib/api/security-errors';

export function safeOutboxPayloadPreview(event: AdminOutboxEvent): string | null {
  const source = event.sanitizedPayload;
  if (source == null) return null;
  try {
    let s = JSON.stringify(source);
    s = s.replace(/\b\d{10,16}\b/g, '***');
    s = s.replace(/\bBearer\s+[A-Za-z0-9._-]+\b/gi, 'Bearer ***');
    if (s.length > 180) s = `${s.slice(0, 180)}…`;
    return s;
  } catch {
    return null;
  }
}

export function deriveJobHealth(job: AdminJobState): 'healthy' | 'degraded' | 'unknown' {
  if (job.lastFailureAt && !job.lastSuccessAt) return 'degraded';
  if (!job.lastRunAt && !job.lastSuccessAt && !job.lastFailureAt) return 'unknown';
  if (job.lastFailureAt && job.lastSuccessAt && new Date(job.lastFailureAt) > new Date(job.lastSuccessAt)) {
    return 'degraded';
  }
  return 'healthy';
}

export function shouldPauseOpsPolling(error: unknown): boolean {
  const kind = mapApiError(error).kind;
  return kind === 'unauthenticated' || kind === 'forbidden' || kind === 'rate_limited';
}
