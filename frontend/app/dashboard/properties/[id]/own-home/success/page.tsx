'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { usePropertyDetails } from '@/lib/hooks/use-properties';
import { formatMoney } from '@/lib/hooks/use-wallet';
import { sumMoneyDecimalStrings } from '@/lib/money/format-display';
import { DetailRow, GhostButton, PrimaryButton, SectionCard } from '../../../_components/listing-ui';

export default function OwnHomeSuccessPage() {
  const params = useParams();
  const search = useSearchParams();
  const id = params.id as string;
  const amount = search.get('amount') ?? '0';
  const { data: property } = usePropertyDetails(id);

  if (!property) return <div className="h-64 animate-pulse rounded-xl bg-dashboard-border/60" />;

  return (
    <div className="space-y-4 pt-8">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[#BFD3E4]">
        <svg className="h-10 w-10 text-cohold-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="text-center text-sm text-dashboard-body">
        You have successfully bought a home in {property.title}
      </p>
      <SectionCard title="Receipt">
        <DetailRow label="Property name" value={property.title} />
        <DetailRow label="Amount" value={formatMoney(amount, property.currency)} />
        <DetailRow label="Tenure" value="12 months" />
        <DetailRow label="Processing fee" value={formatMoney('100', property.currency)} />
        <DetailRow label="Total payment" value={formatMoney(sumMoneyDecimalStrings(amount, '100'), property.currency)} />
      </SectionCard>
      <div className="grid grid-cols-2 gap-2">
        <GhostButton>View receipt</GhostButton>
        <Link href="/dashboard/properties">
          <PrimaryButton>Go back Listings</PrimaryButton>
        </Link>
      </div>
    </div>
  );
}
