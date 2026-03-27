'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useWalletTransactions, formatMoney, type Transaction } from '@/lib/hooks/use-wallet';
import { ArrowDownLeft, ArrowUpRight, Filter } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/EmptyState';

const TYPE_LABELS: Record<string, string> = {
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  TRANSFER: 'Transfer',
  SWAP: 'Swap',
  INVESTMENT: 'Investment',
  P2P: 'P2P',
};
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const isCredit = transaction.direction === 'CREDIT';
  const typeLabel = TYPE_LABELS[transaction.type] ?? transaction.type;
  const statusLabel = STATUS_LABELS[transaction.status] ?? transaction.status;
  return (
    <div className="flex items-center justify-between rounded-xl border border-dashboard-border bg-dashboard-card px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cohold-icon-bg">
          {isCredit ? <ArrowDownLeft className="h-5 w-5 text-green-600" /> : <ArrowUpRight className="h-5 w-5 text-dashboard-body" />}
        </span>
        <div className="min-w-0">
          <p className="font-medium text-dashboard-heading truncate">{typeLabel}</p>
          <p className="text-xs text-dashboard-body truncate">{transaction.reference}</p>
          <p className="text-xs text-dashboard-muted mt-0.5">{statusLabel}</p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className={isCredit ? 'font-semibold text-green-600' : 'font-semibold text-dashboard-heading'}>
          {isCredit ? '+' : '-'}{formatMoney(transaction.amount, transaction.currency)}
        </p>
        <p className="text-xs text-dashboard-muted">{transaction.currency}</p>
      </div>
    </div>
  );
}

export default function AccountTransactionsPage() {
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useWalletTransactions({
    page: 1,
    limit: 50,
    ...(typeFilter && { type: typeFilter }),
    ...(statusFilter && { status: statusFilter }),
    ...(directionFilter && { direction: directionFilter }),
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="min-h-screen bg-dashboard-bg pb-20">
      <div className="space-y-6 px-4 pt-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/account" className="p-2 rounded-lg hover:bg-dashboard-border/50 text-dashboard-heading" aria-label="Back">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-xl font-semibold text-dashboard-heading">Transactions</h1>
        </div>
        <p className="text-sm text-dashboard-body">View and filter your transaction history.</p>

        <button type="button" onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 rounded-xl border border-dashboard-border bg-dashboard-card px-4 py-2.5 text-sm font-medium text-dashboard-heading">
          <Filter className="h-4 w-4" /> Filters
        </button>

        {showFilters && (
          <div className="rounded-xl border border-dashboard-border bg-dashboard-card p-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-dashboard-body block mb-1">Type</label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full rounded-lg border border-dashboard-border bg-white px-3 py-2 text-sm text-dashboard-heading">
                <option value="">All</option>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-dashboard-body block mb-1">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-lg border border-dashboard-border bg-white px-3 py-2 text-sm text-dashboard-heading">
                <option value="">All</option>
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-dashboard-body block mb-1">Direction</label>
              <select value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value)} className="w-full rounded-lg border border-dashboard-border bg-white px-3 py-2 text-sm text-dashboard-heading">
                <option value="">All</option>
                <option value="CREDIT">Credit</option>
                <option value="DEBIT">Debit</option>
              </select>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="rounded-xl border border-dashboard-border bg-dashboard-card p-4 h-20 animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No transactions yet."
            message="You do not have any transactions yet. All transaction updates will appear here and in your activity history."
            icon={<ArrowUpRight className="h-7 w-7" />}
            cta={{ label: 'Go to Home', href: '/dashboard/home' }}
            className="p-8"
          />
        ) : (
          <div className="space-y-2">
            {items.map((t) => <TransactionRow key={t.id} transaction={t} />)}
            {meta && meta.total > items.length && <p className="text-center text-xs text-dashboard-muted py-2">Showing {items.length} of {meta.total}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
