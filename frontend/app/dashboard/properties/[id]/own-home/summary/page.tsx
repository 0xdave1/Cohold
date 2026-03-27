'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { usePropertyDetails } from '@/lib/hooks/use-properties';
import { formatMoney } from '@/lib/hooks/use-wallet';
import { BackIconButton, DetailRow, GhostButton, PrimaryButton, SectionCard } from '../../../_components/listing-ui';

export default function OwnHomeSummaryPage() {
  const params = useParams();
  const search = useSearchParams();
  const id = params.id as string;
  const amount = search.get('amount') ?? '0';
  const { data: property } = usePropertyDetails(id);

  if (!property) return <div className="h-64 animate-pulse rounded-xl bg-dashboard-border/60" />;

  return (
    <div className="space-y-4">
      <BackIconButton href={`/dashboard/properties/${id}/own-home?amount=${amount}`} />
      <div>
        <h1 className="text-xl font-semibold text-dashboard-heading">Own a home summary</h1>
        <p className="text-xs text-dashboard-body">Review purchase details</p>
      </div>
      <SectionCard title="Summary">
        <DetailRow label="Property name" value={property.title} />
        <DetailRow label="Amount" value={formatMoney(amount, property.currency)} />
        <DetailRow label="Tenure" value="12 months" />
        <DetailRow label="Processing fee" value={formatMoney('100', property.currency)} />
        <DetailRow label="Total payment" value={formatMoney(String(Number(amount) + 100), property.currency)} />
      </SectionCard>
      <div className="grid grid-cols-2 gap-2">
        <Link href={`/dashboard/properties/${id}/own-home?amount=${amount}`}>
          <GhostButton>Go back</GhostButton>
        </Link>
        <Link href={`/dashboard/properties/${id}/own-home/success?amount=${amount}`}>
          <PrimaryButton>Buy</PrimaryButton>
        </Link>
      </div>
    </div>
  );
}
