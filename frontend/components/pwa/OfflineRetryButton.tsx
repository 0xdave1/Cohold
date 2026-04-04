'use client';

export function OfflineRetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="inline-flex justify-center rounded-full bg-[#00406C] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 min-h-[44px] items-center w-full sm:w-auto"
    >
      Retry
    </button>
  );
}
