'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useWithdrawal, type WithdrawalStatusUi } from '@/lib/hooks/use-withdrawals';
import { formatMoney } from '@/lib/hooks/use-wallet';

function statusCopy(status: WithdrawalStatusUi): { title: string; subtitle: string } {
  switch (status) {
    case 'PENDING':
      return {
        title: 'Withdrawal request received',
        subtitle: 'Your payout request has been accepted and is queued for provider processing.',
      };
    case 'PROCESSING':
      return {
        title: 'Withdrawal in progress',
        subtitle: 'Payout has been initiated and is currently being processed by the provider.',
      };
    case 'COMPLETED':
      return {
        title: 'Withdrawal successful 🎉',
        subtitle: '', // filled with amount line below
      };
    case 'FAILED':
      return {
        title: 'Withdrawal failed',
        subtitle: 'Your withdrawal could not be completed.',
      };
    case 'CANCELLED':
      return {
        title: 'Withdrawal cancelled',
        subtitle: 'This withdrawal was cancelled.',
      };
    default:
      return { title: 'Withdrawal', subtitle: '' };
  }
}

function StatusIcon({ status }: { status: WithdrawalStatusUi }) {
  if (status === 'COMPLETED') {
    return (
      <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-[#D6EDF8]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cohold-blue">
          <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
    );
  }
  if (status === 'FAILED') {
    return (
      <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-red-50">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500">
          <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-amber-50">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400">
        <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    </div>
  );
}

export default function WithdrawalResultPage() {
  const params = useParams();
  const router = useRouter();
  const withdrawalId = typeof params.withdrawalId === 'string' ? params.withdrawalId : '';

  const { data: w, isLoading, isError, error, refetch } = useWithdrawal(withdrawalId || null);

  if (!withdrawalId) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
        <p className="text-sm text-dashboard-body">Missing withdrawal reference.</p>
        <Link href="/dashboard/home" className="mt-4 text-sm font-semibold text-cohold-blue">
          Go back Home
        </Link>
      </div>
    );
  }

  if (isLoading || !w) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-dashboard-body" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-10 text-center">
        <p className="text-sm text-red-600">{error instanceof Error ? error.message : 'Could not load withdrawal'}</p>
        <button type="button" onClick={() => refetch()} className="text-sm font-semibold text-cohold-blue underline">
          Retry
        </button>
        <Link href="/dashboard/home" className="block text-sm text-dashboard-body underline">
          Go back Home
        </Link>
      </div>
    );
  }

  const { title, subtitle } = statusCopy(w.status);
  const recipient = w.recipientBank;
  const acct = recipient?.accountNumber ?? '—';
  const name = recipient?.accountName ?? '—';
  const bank = recipient?.bankName ?? '—';

  const successLine =
    w.status === 'COMPLETED'
      ? `You have successfully withdrawn ${formatMoney(w.amount, 'NGN' as const)}.`
      : subtitle;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-28 pt-8">
      <div className="flex flex-1 flex-col items-center text-center">
        <StatusIcon status={w.status} />
        <h1 className="mt-6 text-xl font-semibold text-dashboard-heading">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-dashboard-body">{successLine}</p>
        {w.status === 'FAILED' && w.failureReason ? (
          <p className="mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">{w.failureReason}</p>
        ) : null}
        <p className="mt-2 text-[11px] text-dashboard-body/70">Ref: {w.reference}</p>
      </div>

      <div className="mt-8 w-full rounded-2xl border border-dashboard-border bg-dashboard-card p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        <p className="mb-3 text-left text-xs font-medium uppercase tracking-wide text-dashboard-body">Recipient details</p>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-dashboard-body">Account number</span>
            <span className="max-w-[55%] text-right font-mono font-semibold text-dashboard-heading">{acct}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-dashboard-body">Account name</span>
            <span className="max-w-[55%] text-right font-semibold text-dashboard-heading">{name}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-dashboard-body">Bank name</span>
            <span className="max-w-[55%] text-right font-semibold text-dashboard-heading">{bank}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <Link
          href="/dashboard/account/transactions"
          className="rounded-full border border-dashboard-border bg-white py-3 text-center text-sm font-semibold text-cohold-blue hover:bg-dashboard-border/30"
        >
          View receipt
        </Link>
        <button
          type="button"
          onClick={() => router.push('/dashboard/home')}
          className="rounded-full bg-cohold-blue py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Go back Home
        </button>
      </div>
      {(w.status === 'PENDING' || w.status === 'PROCESSING') && (
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 w-full rounded-full border border-dashboard-border bg-white py-2.5 text-sm font-semibold text-dashboard-heading hover:bg-dashboard-border/20"
        >
          Refresh status
        </button>
      )}
    </div>
  );
}
