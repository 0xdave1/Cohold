'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useP2PExecute, useP2PPreview } from '@/lib/hooks/use-p2p';
import { useP2PStore } from '@/stores/p2p.store';

function formatMoney(currency: string, amount: string) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${currency} ${amount}`;
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(n);
}

function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `p2p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function P2PSummaryPage() {
  const router = useRouter();
  const recipient = useP2PStore((s) => s.recipient);
  const preview = useP2PStore((s) => s.preview);
  const setPreview = useP2PStore((s) => s.setPreview);
  const setLastReceipt = useP2PStore((s) => s.setLastReceipt);

  const amount = useP2PStore((s) => s.amount);
  const currency = useP2PStore((s) => s.currency);
  // Note is optional in the backend; UI intentionally omits it to match the Figma flow.

  const previewMutation = useP2PPreview();
  const executeMutation = useP2PExecute();

  const canLoad = useMemo(() => !!recipient && !!amount, [recipient, amount]);

  useEffect(() => {
    if (!canLoad) return;
    // Always fetch a fresh preview for the summary screen.
    previewMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad, recipient?.id, amount, currency]);

  if (!recipient) {
    router.replace('/dashboard/wallets/p2p');
    return null;
  }

  const p = previewMutation.data ?? preview;
  const avatar = (recipient.displayName?.[0] ?? recipient.username[0] ?? 'U').toUpperCase();

  return (
    <div className="space-y-6 pb-28 max-w-sm mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/wallets/p2p/amount')} aria-label="Back">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-dashboard-heading">P2P summary</h1>
      </div>

      <p className="text-xs text-dashboard-body">
        Review the details below before sending.
      </p>

      <div className="flex items-center justify-center gap-3 p-4">
        <div className="h-12 w-12 rounded-full bg-[#F5D99A] flex items-center justify-center text-cohold-blue font-semibold text-lg">
          {avatar}
        </div>
        <div className="text-center">
          <div className="font-semibold text-lg text-dashboard-heading">
            {recipient.displayName ?? `@${recipient.username}`}
          </div>
          <div className="text-xs text-dashboard-body">@{recipient.username}</div>
        </div>
      </div>

      {previewMutation.isPending ? (
        <div className="flex items-center justify-center rounded-2xl border border-dashboard-border bg-dashboard-card p-6">
          <Loader2 className="h-5 w-5 animate-spin text-dashboard-body" />
        </div>
      ) : previewMutation.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {previewMutation.error instanceof Error ? previewMutation.error.message : 'Failed to load preview'}
          <button
            type="button"
            className="mt-2 text-sm font-semibold text-cohold-link underline"
            onClick={() => previewMutation.mutate()}
          >
            Retry
          </button>
        </div>
      ) : p ? (
        <div className="rounded-2xl border border-dashboard-border bg-white p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-xs text-dashboard-body">Amount sent</span>
            <span className="font-semibold text-dashboard-heading">{formatMoney(p.currency, p.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-dashboard-body">Amount received</span>
            <span className="font-semibold text-dashboard-heading">{formatMoney(p.currency, p.recipientAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-dashboard-body">Processing fee</span>
            <span className="font-semibold text-dashboard-heading">{formatMoney(p.currency, p.fee)}</span>
          </div>
        </div>
      ) : null}

      <div className="flex gap-3 pt-1">
        <button
          onClick={() => router.push('/dashboard/wallets/p2p/amount')}
          className="flex-1 rounded-xl border border-dashboard-border bg-white px-4 py-3 text-sm font-semibold text-dashboard-heading"
        >
          Go back
        </button>
        <button
          onClick={async () => {
            setPreview(p ?? null);
            const receipt = await executeMutation.mutateAsync(createIdempotencyKey());
            setLastReceipt(receipt);
            router.push(`/dashboard/wallets/p2p/success?id=${encodeURIComponent(receipt.id)}`);
          }}
          disabled={executeMutation.isPending || previewMutation.isPending || !p}
          className="flex-1 rounded-xl bg-cohold-blue px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {executeMutation.isPending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

