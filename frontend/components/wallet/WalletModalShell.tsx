'use client';

import type { ReactNode } from 'react';

type WalletModalShellProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function WalletModalShell({ title, onClose, children, footer }: WalletModalShellProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-modal-title"
    >
      <div className="w-full max-w-md rounded-t-2xl bg-dashboard-card p-6 shadow-xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="wallet-modal-title" className="text-lg font-semibold text-dashboard-heading">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-dashboard-body hover:bg-dashboard-border/50"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
}
