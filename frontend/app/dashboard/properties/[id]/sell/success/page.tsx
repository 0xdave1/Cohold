'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePropertyDetails } from '@/lib/hooks/use-properties';
import { readSellReceipt, type StoredSellReceipt } from '@/lib/sell/sell-receipt-storage';
import Decimal from 'decimal.js';
import { DetailRow, SectionCard } from '../../../_components/listing-ui';

/** Same strings returned by the sell API (`formatMoney` on backend = fixed 4 dp). */
function LedgerAmount({ amountStr, currency }: { amountStr: string; currency: string }) {
  return (
    <span className="font-mono tabular-nums text-xs text-dashboard-heading">
      {currency} {amountStr}
    </span>
  );
}

export default function SellSuccessPage() {
  const params = useParams();
  const search = useSearchParams();
  const id = params.id as string;
  const { data: property } = usePropertyDetails(id);
  const [receipt, setReceipt] = useState<StoredSellReceipt | null>(null);

  useEffect(() => {
    const fromStorage = readSellReceipt(id);
    if (fromStorage) {
      setReceipt(fromStorage);
      return;
    }

    const shares = search.get('shares') ?? '0';
    const sellAmount = search.get('sellAmount') ?? search.get('amount') ?? '';
    const costBasis = search.get('costBasis') ?? '';
    const fee = search.get('fee') ?? '';
    const net = search.get('net') ?? search.get('total') ?? '';
    const walletAfter = search.get('walletAfter') ?? '';

    if (!sellAmount && !fee && !net) return;

    console.warn(
      '[Cohold] Sell success: using URL query fallback; prefer sessionStorage receipt from confirm flow.',
      { propertyId: id },
    );

    const cur = property?.currency ?? 'NGN';
    setReceipt({
      propertyId: id,
      shares,
      sellAmount: sellAmount || '0',
      platformFee: fee || '0',
      netToUser: net || '0',
      costBasis: costBasis || '0',
      walletBalanceAfter: walletAfter || undefined,
      currency: cur,
      savedAt: Date.now(),
    });
  }, [id, search, property?.currency]);

  if (!property) return <div className="h-64 animate-pulse rounded-xl bg-dashboard-border/60" />;

  if (!receipt) {
    return (
      <div className="space-y-4 pt-8">
        <p className="text-center text-sm text-dashboard-body px-2">
          Receipt details aren&apos;t available here. Open your transactions for the settled amounts.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/dashboard/account/transactions"
            className="flex h-11 w-full items-center justify-center rounded-full bg-cohold-blue px-4 text-sm font-medium text-white"
          >
            View transactions
          </Link>
          <Link
            href="/dashboard/investments"
            className="flex h-11 w-full items-center justify-center rounded-full bg-dashboard-border/60 px-4 text-sm font-medium text-dashboard-heading"
          >
            Portfolio
          </Link>
        </div>
      </div>
    );
  }

  const net = receipt.netToUser;

  return (
    <div className="space-y-4 pt-8">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[#BFD3E4]">
        <svg className="h-10 w-10 text-cohold-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="text-center text-sm text-dashboard-body px-2">
        You sold {receipt.shares}{' '}
        {new Decimal(receipt.shares || '0').eq(1) ? 'share' : 'shares'} in {property.title}.{' '}
        <span className="font-semibold text-dashboard-heading">
          <LedgerAmount amountStr={net} currency={receipt.currency} />
        </span>{' '}
        was credited to your wallet
        {new Decimal(receipt.platformFee || '0').gt(0)
          ? ' (after platform fee on profit).'
          : ' (no fee — no realised profit on this sale).'}
      </p>

      <SectionCard title="Receipt summary">
        <DetailRow label="Property name" value={property.title} />
        <DetailRow label="Shares sold" value={receipt.shares} />
        <DetailRow
          label="Gross proceeds"
          value={<LedgerAmount amountStr={receipt.sellAmount} currency={receipt.currency} />}
        />
        <DetailRow
          label="Cost basis"
          value={<LedgerAmount amountStr={receipt.costBasis} currency={receipt.currency} />}
        />
        <DetailRow
          label="Platform fee (on profit)"
          value={<LedgerAmount amountStr={receipt.platformFee} currency={receipt.currency} />}
        />
        <DetailRow
          label="Net credited to wallet"
          value={<LedgerAmount amountStr={receipt.netToUser} currency={receipt.currency} />}
        />
        {receipt.walletBalanceAfter ? (
          <DetailRow
            label="Wallet balance after"
            value={<LedgerAmount amountStr={receipt.walletBalanceAfter} currency={receipt.currency} />}
          />
        ) : null}
      </SectionCard>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/dashboard/account/transactions"
          className="flex h-11 w-full items-center justify-center rounded-full bg-dashboard-border/60 px-4 text-sm font-medium text-dashboard-heading"
        >
          View transactions
        </Link>
        <Link
          href="/dashboard/investments"
          className="flex h-11 w-full items-center justify-center rounded-full bg-cohold-blue px-4 text-sm font-medium text-white"
        >
          Portfolio
        </Link>
      </div>
    </div>
  );
}
