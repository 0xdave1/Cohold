'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePropertyDetails } from '@/lib/hooks/use-properties';
import { formatMoney } from '@/lib/hooks/use-wallet';
import { DetailRow, SectionCard } from '../../../_components/listing-ui';
import { readInvestmentReceipt, type StoredInvestmentReceipt } from '@/lib/investment/investment-receipt-storage';

export default function InvestSuccessPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: property } = usePropertyDetails(id);
  const [receipt, setReceipt] = useState<StoredInvestmentReceipt | null>(null);

  useEffect(() => {
    setReceipt(readInvestmentReceipt(id));
  }, [id]);

  if (!property) return <div className="h-64 animate-pulse rounded-xl bg-dashboard-border/60" />;
  if (!receipt) {
    return (
      <div className="space-y-4 pt-8">
        <p className="text-center text-sm text-dashboard-body px-2">
          Investment receipt details are not available here yet. Open transactions for posted ledger entries.
        </p>
        <p className="text-center text-xs text-dashboard-body">
          Certificate generation coming soon.
        </p>
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

  return (
    <div className="space-y-4 pt-8">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[#BFD3E4]">
        <svg className="h-10 w-10 text-cohold-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="text-center text-sm text-dashboard-body">
        Investment confirmed for {receipt.shares} {Number(receipt.shares) === 1 ? 'share' : 'shares'} in {property.title}.
      </p>

      <SectionCard title="Receipt">
        <DetailRow label="Property name" value={property.title} />
        <DetailRow label="Investment ID" value={receipt.investmentId || 'Pending assignment'} />
        <DetailRow label="Principal charged" value={formatMoney(receipt.amount, property.currency)} />
        <DetailRow label="No. of shares" value={receipt.shares} />
        <DetailRow label="Status" value={receipt.status} />
        <DetailRow label="Ledger/reference" value={receipt.reference || 'Pending reference'} />
        <DetailRow label="Timestamp" value={new Date(receipt.createdAt).toLocaleString()} />
      </SectionCard>
      <p className="text-center text-xs text-dashboard-body">
        Certificate generation coming soon. Investments carry risk and returns are not guaranteed.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/dashboard/account/transactions"
          className="flex h-11 w-full items-center justify-center rounded-full bg-dashboard-border/60 px-4 text-sm font-medium text-dashboard-heading"
        >
          View receipt
        </Link>
        <Link
          href="/dashboard/investments"
          className="flex h-11 w-full items-center justify-center rounded-full bg-cohold-blue px-4 text-sm font-medium text-white"
        >
          Back to investments
        </Link>
      </div>
    </div>
  );
}
