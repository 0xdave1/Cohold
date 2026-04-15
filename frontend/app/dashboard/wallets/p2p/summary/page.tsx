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
  const note = useP2PStore((s) => s.note);
  const setNote = useP2PStore((s) => s.setNote);

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
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/wallets/p2p/amount')} aria-label="Back">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">P2P summary</h1>
      </div>

      <div className="flex items-center justify-center gap-3 p-4">
        <div className="h-12 w-12 rounded-full bg-orange-500 flex items-center justify-center text-white font-medium text-lg">
          {avatar}
        </div>
        <div className="text-center">
          <div className="font-medium text-lg">{recipient.displayName ?? `@${recipient.username}`}</div>
          <div className="text-xs text-slate-400">@{recipient.username}</div>
        </div>
      </div>

      {previewMutation.isPending ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
        </div>
      ) : previewMutation.isError ? (
        <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
          {previewMutation.error instanceof Error ? previewMutation.error.message : 'Failed to load preview'}
          <button
            type="button"
            className="mt-2 text-sm underline"
            onClick={() => previewMutation.mutate()}
          >
            Retry
          </button>
        </div>
      ) : p ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <div className="flex justify-between">
            <span className="text-slate-400">Amount sent</span>
            <span className="font-medium">{formatMoney(p.currency, p.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Amount received</span>
            <span className="font-medium">{formatMoney(p.currency, p.recipientAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Processing fee</span>
            <span className="font-medium">{formatMoney(p.currency, p.fee)}</span>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <label className="text-xs text-slate-400">Note (optional)</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note"
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => router.push('/dashboard/wallets/p2p/amount')}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 font-medium"
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
          className="flex-1 rounded-lg bg-blue-500 text-white px-4 py-3 font-medium disabled:opacity-50"
        >
          {executeMutation.isPending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

