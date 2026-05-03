'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useCreateInvestment, usePropertyDetails } from '@/lib/hooks/use-properties';
import { mapFinancialIntegrityError } from '@/lib/finance/financial-errors';
import { formatMoney } from '@/lib/hooks/use-wallet';
import { buyPreviewFromShares } from '@/lib/money/buy-preview';
import { INVESTMENT_FEE_RATE } from '@/lib/constants/investment';
import { BackIconButton, DetailRow, PrimaryButton, SectionCard } from '../../../_components/listing-ui';

export default function InvestSummaryPage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: property } = usePropertyDetails(id);
  const createInvestment = useCreateInvestment();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shares = search.get('shares') ?? '1';
  const sharePrice = property?.sharePrice ?? property?.totalValue ?? '0';

  const breakdown = useMemo(() => {
    const p = search.get('principal');
    const f = search.get('fee');
    const t = search.get('total');
    if (p != null && f != null && t != null && p !== '' && f !== '' && t !== '') {
      return { principal: p, fee: f, totalCharge: t };
    }
    return buyPreviewFromShares(String(sharePrice), shares);
  }, [search, sharePrice, shares]);

  if (!property) return <div className="h-64 animate-pulse rounded-xl bg-dashboard-border/60" />;

  const submit = async () => {
    setErrorMessage(null);
    try {
      await createInvestment.mutateAsync({
        propertyId: id,
        shares,
        clientReference: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      });
      router.push(
        `/dashboard/properties/${id}/invest/success?shares=${encodeURIComponent(shares)}&amount=${encodeURIComponent(breakdown.principal)}&fee=${encodeURIComponent(breakdown.fee)}&total=${encodeURIComponent(breakdown.totalCharge)}`,
      );
    } catch (e: unknown) {
      setErrorMessage(mapFinancialIntegrityError(e, 'Investment could not be completed.'));
    }
  };

  return (
    <div className="space-y-4">
      <BackIconButton href={`/dashboard/properties/${id}/invest?shares=${encodeURIComponent(shares)}`} />
      <div>
        <h1 className="text-xl font-semibold text-dashboard-heading">Buy summary</h1>
        <p className="text-xs text-dashboard-body">Review buy details — fee {INVESTMENT_FEE_RATE * 100}% on principal (on top).</p>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <SectionCard title="Summary">
        <DetailRow label="Property name" value={property.title} />
        <DetailRow label="Principal" value={formatMoney(breakdown.principal, property.currency)} />
        <DetailRow label="No. of shares" value={shares} />
        <DetailRow label="Investment fee" value={formatMoney(breakdown.fee, property.currency)} />
        <DetailRow label="Total charge" value={formatMoney(breakdown.totalCharge, property.currency)} />
      </SectionCard>

      <p className="text-center text-[11px] text-dashboard-body">
        You will be charged: {formatMoney(breakdown.totalCharge, property.currency)} (wallet updates only after the server confirms the debit).
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/dashboard/properties/${id}/invest?shares=${encodeURIComponent(shares)}`}
          className="flex h-11 w-full items-center justify-center rounded-full bg-dashboard-border/60 px-4 text-sm font-medium text-dashboard-heading"
        >
          Go back
        </Link>
        <PrimaryButton onClick={submit} disabled={createInvestment.isPending}>
          {createInvestment.isPending ? 'Investing...' : 'Buy shares'}
        </PrimaryButton>
      </div>
    </div>
  );
}
