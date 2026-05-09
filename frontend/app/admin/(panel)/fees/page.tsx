'use client';

import Link from 'next/link';

export default function FeeLogsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Fee logs</h1>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
        <p className="font-medium">Not available in this API</p>
        <p className="mt-2 text-amber-900/90">
          The backend does not expose an <code className="rounded bg-white/60 px-1">admin/fees</code> listing in this
          deployment, so this page does not load placeholder rows. For fee-related cash movements, use{' '}
          <Link href="/admin/wallet-transactions" className="font-semibold text-[#1a3a4a] underline">
            Wallet transactions
          </Link>{' '}
          and distribution batches where applicable.
        </p>
      </div>
    </div>
  );
}
