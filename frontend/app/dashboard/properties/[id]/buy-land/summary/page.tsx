'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { usePropertyDetails } from '@/lib/hooks/use-properties';
import { formatMoney } from '@/lib/hooks/use-wallet';
import { BackIconButton, DetailRow, GhostButton, PrimaryButton, SectionCard } from '../../../_components/listing-ui';

export default function BuyLandSummaryPage() {
  const params = useParams();
  const search = useSearchParams();
  const id = params.id as string;
  const { data: property } = usePropertyDetails(id);
  const amount = search.get('amount') ?? '0';

  if (!property) return <div className="h-64 animate-pulse rounded-xl bg-dashboard-border/60" />;

  return (
    <div className="space-y-4">
      <BackIconButton href={`/dashboard/properties/${id}/buy-land?amount=${amount}`} />
      <div>
        <h1 className="text-xl font-semibold text-dashboard-heading">Buy land summary</h1>
        <p className="text-xs text-dashboard-body">Review land purchase details</p>
      </div>
      <SectionCard title="Summary">
        <DetailRow label="Property name" value={property.title} />
        <DetailRow label="Land purchase amount" value={formatMoney(amount, property.currency)} />
        <DetailRow label="Plot size" value="300sqm" />
        <DetailRow label="Processing fee" value={formatMoney('100', property.currency)} />
        <DetailRow label="Total payment" value={formatMoney(String(Number(amount) + 100), property.currency)} />
      </SectionCard>
      <div className="grid grid-cols-2 gap-2">
        <Link href={`/dashboard/properties/${id}/buy-land?amount=${amount}`}>
          <GhostButton>Go back</GhostButton>
        </Link>
        <Link href={`/dashboard/properties/${id}/buy-land/success?amount=${amount}`}>
          <PrimaryButton>Buy</PrimaryButton>
        </Link>
      </div>
    </div>
  );
}
