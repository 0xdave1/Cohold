'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  invalidateInvestmentRelatedQueries,
  usePropertyDetails,
  useSellFractional,
} from '@/lib/hooks/use-properties';
import { useMyInvestments } from '@/lib/hooks/use-investments';
import { formatMoney } from '@/lib/hooks/use-wallet';
import { estimateSellFifoPreview } from '@/lib/money/sell-preview';
import { SELL_PROFIT_FEE_RATE } from '@/lib/constants/investment';
import { saveSellReceipt } from '@/lib/sell/sell-receipt-storage';
import { logSellPreviewVsBackendMismatch } from '@/lib/sell/sell-preview-audit';
import { BackIconButton, DetailRow, PrimaryButton, SectionCard } from '../../../_components/listing-ui';

export default function SellSummaryPage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const { data: property } = usePropertyDetails(id);
  const { data: investmentsData } = useMyInvestments(1, 100);
  const sellMutation = useSellFractional();

  const shares = search.get('shares') ?? '0';
  const sharePrice = property?.sharePrice ?? property?.totalValue ?? '0';

  const positions = useMemo(() => {
    const items = investmentsData?.items ?? [];
    return items
      .filter((i) => i.propertyId === id && (i.status ?? 'ACTIVE') === 'ACTIVE')
      .map((i) => ({
        id: i.id,
        shares: i.shares,
        amount: i.amount,
        sharePrice: i.sharePrice ?? sharePrice,
        createdAt: i.createdAt,
      }));
  }, [investmentsData?.items, id, sharePrice]);

  const preview = useMemo(() => {
    if (!property) return null;
    return estimateSellFifoPreview(sharePrice, shares, positions);
  }, [property, sharePrice, shares, positions]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!property) return <div className="h-64 animate-pulse rounded-xl bg-dashboard-border/60" />;

  const submit = async () => {
    setErrorMessage(null);
    try {
      const data = await sellMutation.mutateAsync({
        propertyId: id,
        sharesToSell: shares,
        clientReference: `SELL-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      });

      logSellPreviewVsBackendMismatch(preview, {
        sellAmount: data.sellAmount,
        fee: data.fee,
        netToUser: data.netToUser,
        costBasis: data.costBasis,
      }, id);

      saveSellReceipt({
        propertyId: id,
        shares,
        sellAmount: data.sellAmount,
        platformFee: data.fee,
        netToUser: data.netToUser,
        costBasis: data.costBasis,
        walletBalanceAfter: data.walletBalanceAfter,
        currency: property.currency,
      });

      await invalidateInvestmentRelatedQueries(queryClient);
      router.push(`/dashboard/properties/${id}/sell/success`);
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : 'Sell failed');
    }
  };

  return (
    <div className="space-y-4">
      <BackIconButton href={`/dashboard/properties/${id}/sell?shares=${encodeURIComponent(shares)}`} />
      <div>
        <h1 className="text-xl font-semibold text-dashboard-heading">Sell summary</h1>
        <p className="text-xs text-dashboard-body">
          Platform fee is {SELL_PROFIT_FEE_RATE * 100}% of <span className="font-medium">profit only</span> (not on
          principal). Settlement matches this preview when prices align.
        </p>
      </div>

      {preview === null && Number(shares) > 0 ? (
        <p className="text-xs text-amber-800">
          Could not estimate sale (check share price matches your positions or insufficient shares).
        </p>
      ) : null}

      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <SectionCard title="Estimated breakdown (FIFO)">
        <DetailRow label="Property name" value={property.title} />
        <DetailRow label="Shares to sell" value={shares} />
        <DetailRow label="Gross proceeds" value={preview ? formatMoney(preview.sellAmount, property.currency) : '—'} />
        <DetailRow label="Cost basis" value={preview ? formatMoney(preview.costBasis, property.currency) : '—'} />
        <DetailRow label="Realised profit" value={preview ? formatMoney(preview.profit, property.currency) : '—'} />
        <DetailRow
          label={`Platform fee (${SELL_PROFIT_FEE_RATE * 100}% of profit)`}
          value={preview ? formatMoney(preview.platformFee, property.currency) : '—'}
        />
        <DetailRow
          label="Net to your wallet"
          value={preview ? formatMoney(preview.netToUser, property.currency) : '—'}
        />
      </SectionCard>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/dashboard/properties/${id}/sell?shares=${encodeURIComponent(shares)}`}
          className="flex h-11 w-full items-center justify-center rounded-full bg-dashboard-border/60 px-4 text-sm font-medium text-dashboard-heading"
        >
          Go back
        </Link>
        <PrimaryButton type="button" onClick={submit} disabled={sellMutation.isPending || Number(shares) <= 0}>
          {sellMutation.isPending ? 'Selling…' : 'Confirm sale'}
        </PrimaryButton>
      </div>
    </div>
  );
}
