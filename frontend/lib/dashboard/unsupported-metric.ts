/**
 * Issue 12: never substitute fake zero for unsupported backend metrics.
 */
export function unsupportedMetricLabel(value: string | null | undefined): string {
  if (value != null && String(value).trim() !== '') return String(value);
  return 'Not available';
}

export function unsupportedMetricHint(reason?: string | null): string | undefined {
  const r = reason?.trim();
  return r && r.length > 0 ? r : undefined;
}
