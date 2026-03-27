'use client';

interface LogoutModalProps {
  onClose: () => void;
  onConfirm: () => void;
}

export function LogoutModal({ onClose, onConfirm }: LogoutModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-dashboard-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 id="logout-title" className="text-lg font-semibold text-dashboard-heading">
            Logout
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dashboard-border/50 text-dashboard-heading"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-dashboard-body mb-6">
          Are you sure you want to temporarily logout from this account?
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full rounded-xl border border-dashboard-border bg-transparent py-3 text-sm font-medium text-dashboard-heading hover:bg-dashboard-border/30"
          >
            Yes, logout
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-cohold-blue py-3 text-sm font-medium text-white hover:opacity-90"
          >
            No, cancel
          </button>
        </div>
      </div>
    </div>
  );
}
