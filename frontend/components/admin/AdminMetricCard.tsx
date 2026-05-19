'use client';

import type { DashboardMetric } from '@/lib/admin/dashboard-metrics';
import { formatMetricDisplay } from '@/lib/admin/dashboard-metrics';
import { adminTheme } from '@/lib/admin/admin-theme';

export type MetricTone = 'neutral' | 'success' | 'warning' | 'danger';

function mapMetricTone(tone?: DashboardMetric['tone']): MetricTone {
  if (tone === 'critical') return 'danger';
  if (tone === 'attention') return 'warning';
  if (tone === 'healthy') return 'success';
  return 'neutral';
}

export function adminMetricCardToneClass(tone: MetricTone, loading?: boolean): string {
  if (loading) return 'border-[#DDD8D2] bg-white';
  switch (tone) {
    case 'danger':
      return 'border-red-200 bg-red-50/60';
    case 'warning':
      return 'border-amber-200 bg-amber-50/60';
    case 'success':
      return 'border-emerald-200 bg-emerald-50/40';
    default:
      return 'border-[#DDD8D2] bg-white';
  }
}

function trendColor(tone: MetricTone): string {
  if (tone === 'danger') return adminTheme.danger;
  if (tone === 'warning') return '#D97706';
  if (tone === 'success') return adminTheme.success;
  return adminTheme.muted;
}

type Props = {
  metric?: DashboardMetric;
  label?: string;
  loading?: boolean;
  error?: boolean;
  trend?: string;
  className?: string;
};

export function AdminMetricCard({ metric, label, loading, error, trend, className = '' }: Props) {
  const tone = metric ? mapMetricTone(metric.tone) : 'neutral';
  const displayLabel = label ?? metric?.label ?? '—';

  if (loading) {
    return (
      <div aria-busy="true" className={`rounded-xl border p-4 ${adminMetricCardToneClass('neutral', true)} ${className}`}>
        <div className="h-3 w-24 animate-pulse rounded bg-[#DDD8D2]" />
        <div className="mt-3 h-8 w-32 animate-pulse rounded bg-[#DDD8D2]" />
        <div className="mt-2 h-3 w-20 animate-pulse rounded bg-[#DDD8D2]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-xl border border-red-200 bg-red-50/50 p-4 ${className}`}>
        <p className="text-xs font-medium text-[#6F6A64]">{displayLabel}</p>
        <p className="mt-2 text-lg font-semibold text-[#171717]">Not available</p>
        <p className="mt-1 text-xs text-[#DC2626]">Failed to load metric</p>
      </div>
    );
  }

  const { primary, sub } = metric ? formatMetricDisplay(metric) : { primary: 'Not available', sub: undefined };
  const trendText = trend ?? sub;

  return (
    <div className={`rounded-xl border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${adminMetricCardToneClass(tone)} ${className}`}>
      <p className="text-xs font-medium text-[#6F6A64]">{displayLabel}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[#171717]">{primary}</p>
      {trendText ? (
        <p className="mt-1 text-xs font-medium" style={{ color: trendColor(tone) }}>
          {trendText}
        </p>
      ) : null}
    </div>
  );
}
