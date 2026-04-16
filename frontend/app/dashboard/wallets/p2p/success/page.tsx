'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useP2PStore } from '@/stores/p2p.store';
import { Check } from 'lucide-react';

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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 pt-10 pb-28 max-w-sm mx-auto">
      <div className="h-24 w-24 rounded-2xl border border-dashboard-border bg-dashboard-card flex items-center justify-center">
        <div className="h-14 w-14 rounded-2xl bg-cohold-blue flex items-center justify-center">
          <Check className="h-7 w-7 text-white" strokeWidth={3} />
        </div>
      </div>

      <div className="text-center mt-6 space-y-2">
        <h1 className="text-xl font-semibold text-dashboard-heading">P2P Transfer Successful</h1>
        <p className="text-sm text-dashboard-body">{subtitle}</p>
        {receipt?.groupId ? <p className="text-xs text-dashboard-muted">Reference: {receipt.groupId}</p> : null}
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-40">
        <div className="mx-auto max-w-2xl px-4">
          <button
            onClick={() => router.push('/dashboard/home')}
            className="w-full rounded-xl bg-cohold-blue py-3 text-sm font-semibold text-white"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
