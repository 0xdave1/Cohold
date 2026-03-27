'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { usePropertyDetails } from '@/lib/hooks/use-properties';
import { useMyInvestments } from '@/lib/hooks/use-investments';
import { formatMoney } from '@/lib/hooks/use-wallet';
import { BackIconButton, PrimaryButton, SectionCard } from '../../_components/listing-ui';

export default function BuyLandPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: property } = usePropertyDetails(id);
  const { data: myInvestments } = useMyInvestments(1, 100);
  const [amount, setAmount] = useState('');

  const investmentBalanceStr = useMemo(() => {
    const items = myInvestments?.items ?? [];
    const active = items.filter((i) => (i.status ?? 'ACTIVE') === 'ACTIVE');
    const same = active.filter((i) => i.currency === (property?.currency ?? 'NGN'));
    return String(same.reduce((acc, i) => acc + Number(i.amount), 0));
  }, [myInvestments?.items, property?.currency]);

  if (!property) return <div className="h-64 animate-pulse rounded-xl bg-dashboard-border/60" />;
  const cleaned = amount.replace(/,/g, '');

  return (
    <div className="space-y-4">
      <BackIconButton href={`/dashboard/properties/${id}?mode=land`} />
      <div>
        <h1 className="text-xl font-semibold text-dashboard-heading">Buy land</h1>
        <p className="text-xs text-dashboard-body">Enter amount you want to buy the land</p>
      </div>
      <SectionCard title="Plot size amount you want to pay">
        <div className="rounded-lg border border-dashboard-border bg-white px-3 py-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="1,000,000"
            className="w-full bg-transparent text-sm text-dashboard-heading outline-none"
          />
        </div>
        <p className="mt-2 text-[11px] text-dashboard-body">
          Balance: {formatMoney(investmentBalanceStr, property.currency)}
        </p>
      </SectionCard>
      <Link href={`/dashboard/properties/${id}/buy-land/summary?amount=${encodeURIComponent(cleaned || '0')}`}>
        <PrimaryButton>Buy now</PrimaryButton>
      </Link>
    </div>
  );
}
