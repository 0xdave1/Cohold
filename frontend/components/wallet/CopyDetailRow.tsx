'use client';

type CopyDetailRowProps = {
  label: string;
  value: string;
  onCopy: () => void;
};

export function CopyDetailRow({ label, value, onCopy }: CopyDetailRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashboard-border py-3 last:border-0">
      <span className="shrink-0 text-sm text-dashboard-body">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-right font-mono text-sm font-medium text-dashboard-heading">{value}</span>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded-lg p-1.5 text-dashboard-body hover:bg-dashboard-border/50"
          aria-label={`Copy ${label}`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
