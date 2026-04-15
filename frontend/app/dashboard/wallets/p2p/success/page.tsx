'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useP2PStore } from '@/stores/p2p.store';

export default function P2PSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const lastReceipt = useP2PStore((s) => s.lastReceipt);

  const receipt = useMemo(() => {
    if (id && lastReceipt?.id === id) return lastReceipt;
    return lastReceipt ?? null;
  }, [id, lastReceipt]);

  const subtitle = receipt?.recipient
    ? `You have successfully sent ${receipt.currency} ${receipt.amount} to ${
        receipt.recipient.displayName ?? `@${receipt.recipient.username}`
      } through Cohold P2P`
    : receipt
      ? `You have successfully sent ${receipt.currency} ${receipt.amount}.`
      : 'Transfer complete.';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 space-y-6">
      <div className="h-24 w-24 rounded-2xl bg-blue-500 flex items-center justify-center">
        <svg className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold">P2P Transfer Successful</h1>
        <p className="text-sm text-slate-400">
          {subtitle}
        </p>
        {receipt?.groupId ? (
          <p className="text-xs text-slate-500">Reference: {receipt.groupId}</p>
        ) : null}
      </div>

      <button
        onClick={() => router.push('/dashboard/home')}
        className="w-full max-w-md rounded-lg bg-blue-500 text-white py-3 font-medium"
      >
        Back to Home
      </button>
    </div>
  );
}
