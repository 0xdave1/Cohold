'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { usePropertyDetails } from '@/lib/hooks/use-properties';
import { formatMoney } from '@/lib/hooks/use-wallet';
import { DetailRow, SectionCard } from '../../../_components/listing-ui';

export default function InvestSuccessPage() {
  const params = useParams();
  const search = useSearchParams();
  const id = params.id as string;
  const { data: property } = usePropertyDetails(id);

  const shares = search.get('shares') ?? '1';
  const amount = search.get('amount') ?? '0';
  const fee = search.get('fee') ?? '0';
  const total = search.get('total') ?? amount;

  if (!property) return <div className="h-64 animate-pulse rounded-xl bg-dashboard-border/60" />;

  return (
    <div className="space-y-4 pt-8">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[#BFD3E4]">
        <svg className="h-10 w-10 text-cohold-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="text-center text-sm text-dashboard-body">
        You have successfully bought {shares} {Number(shares) === 1 ? 'share' : 'shares'} in {property.title}
      </p>

      <SectionCard title="Receipt">
        <DetailRow label="Property name" value={property.title} />
        <DetailRow label="Principal" value={formatMoney(amount, property.currency)} />
        <DetailRow label="No. of shares" value={shares} />
        <DetailRow label="Investment fee" value={formatMoney(fee, property.currency)} />
        <DetailRow label="Total charged" value={formatMoney(total, property.currency)} />
      </SectionCard>

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
          Back to investment
        </Link>
      </div>
    </div>
  );
}
