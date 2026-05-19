'use client';

import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

export default function FeeLogsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader title="Fee logs" />
      <div className="rounded-xl border border-[#DDD8D2] bg-white px-4 py-4 text-sm text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <p className="font-medium text-[#171717]">Not available in this API</p>
        <p className="mt-2 text-[#6F6A64]">
          The backend does not expose an <code className="rounded bg-[#F5F1EC] px-1">admin/fees</code> listing in this
          deployment, so this page does not load placeholder rows. For fee-related cash movements, use{' '}
          <Link href="/admin/wallet-transactions" className="font-semibold text-[#054870] underline">
            Wallet transactions
          </Link>{' '}
          and distribution batches where applicable.
        </p>
      </div>
    </div>
  );
}
