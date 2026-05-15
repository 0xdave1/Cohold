'use client';

import { useState, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { DashboardHeaderActions } from '@/components/dashboard/DashboardHeaderActions';
import { AccountsModal } from '@/components/wallet/AccountsModal';
import { WithdrawWalletModal } from '@/components/wallet/WithdrawWalletModal';
import { useWalletBalances, formatMoney } from '@/lib/hooks/use-wallet';
import { useMyInvestments } from '@/lib/hooks/use-investments';
import { investmentPositionValue, isActiveInvestmentStatus } from '@/lib/money/portfolio';
import { useProperties } from '@/lib/hooks/use-properties';
import { resolveListingMode } from '@/lib/listings/category';
import { formatAnnualYieldPercent } from '@/lib/format/yield';
import { formatTermForListingCard } from '@/lib/listings/format-term';
import { titleVerificationSubtitleForCard } from '@/lib/listings/legal-status-ui';
import { shortLocationForListingCard } from '@/lib/listings/display-location';
import {
  CategoryPill,
  coholdUi,
  HomeListingSection,
  ListingCarouselRow,
} from '@/app/dashboard/properties/_components/listing-ui';
import { useMe } from '@/lib/hooks/use-onboarding';
import { useDashboardSummary, type DashboardSummary } from '@/lib/hooks/use-dashboard-summary';
import { useOnboardingChecklist } from '@/lib/hooks/use-onboarding-checklist';
import { useAuthStore } from '@/stores/auth.store';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { isKycMoneyActionAllowed } from '@/lib/kyc/status';
import { DashboardTodoShortcuts } from '@/components/dashboard/DashboardTodoShortcuts';
import { getVirtualAccountWalletNotice } from '@/lib/dashboard/virtual-account-ui';

const CURRENCIES: Array<{ code: 'NGN'; flag: string; label: string }> = [
  { code: 'NGN', flag: '🇳🇬', label: 'NGN Account' },
];

function paidDistributionsMeaningful(summary: DashboardSummary): boolean {
  const n = summary.paidDistributionsFromPayouts.payoutCount;
  const raw = summary.paidDistributionsFromPayouts.totalAmount;
  if (n <= 0) return false;
  const v = parseFloat(String(raw).replace(/,/g, ''));
  return Number.isFinite(v) && v > 0;
}

function investmentSummaryAside(summary: DashboardSummary | undefined): ReactNode {
  if (!summary) return null;
  const paid = paidDistributionsMeaningful(summary);
  const activeN = summary.activeInvestments.count;
  const hasActive = activeN > 0;
  if (!paid && !hasActive) return null;
  const segments: string[] = [];
  if (paid) {
    segments.push(
      `Paid distributions (credited): ${formatMoney(summary.paidDistributionsFromPayouts.totalAmount, 'NGN')}`,
    );
  }
  if (hasActive) {
    let line = `Active positions: ${activeN}`;
    if (summary.activeInvestments.principalInvested) {
      line += ` · Principal ${formatMoney(summary.activeInvestments.principalInvested, 'NGN')}`;
    }
    segments.push(line);
  }
  return <p className="mb-2 text-[11px] leading-relaxed text-dashboard-body">{segments.join(' · ')}</p>;
}

export default function HomeDashboardPage() {
  const router = useRouter();
  const userFromStore = useAuthStore((s) => s.user);
  const { data: me } = useMe();
  const { data: dashboardSummary } = useDashboardSummary();
  const { data: onboardingChecklist, isLoading: checklistLoading, isError: checklistError } = useOnboardingChecklist();
  const { data: balances = [], isLoading: balancesLoading } = useWalletBalances();
  const { data: investmentsData } = useMyInvestments();
  const { data: propertiesData } = useProperties(1, 30);

  const displayName = me?.firstName || userFromStore?.firstName || 'User';
  const userEmail = me?.email ?? userFromStore?.email ?? '';
  const initials =
    [me?.firstName?.[0], me?.lastName?.[0]].filter(Boolean).join('').toUpperCase() ||
    (userFromStore?.email?.[0] ?? 'U').toUpperCase();
  const profileImage = me?.profilePhotoUrl ?? me?.profileImageUrl ?? null;
  const meIsVerified = isKycMoneyActionAllowed(me?.kycStatus) && !!me?.onboardingCompletedAt;
  const storeIsVerified =
    isKycMoneyActionAllowed(userFromStore?.kycStatus) && !!userFromStore?.onboardingCompletedAt;
  const isVerified = meIsVerified || storeIsVerified;

  const [selectedCurrency, setSelectedCurrency] = useState<'NGN'>('NGN');
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showUnverifiedModal, setShowUnverifiedModal] = useState<string | null>(null);

  const selectedWallet = balances.find((w) => w.currency === selectedCurrency);
  const rawBalance = selectedWallet ? formatMoney(selectedWallet.balance, selectedCurrency) : '₦0.00';
  const displayBalance = balanceVisible ? rawBalance : '•••••';

  const handleWalletAction = (action: 'top-up' | 'swap' | 'withdraw' | 'p2p' | 'account') => {
    if (!isVerified) {
      setShowUnverifiedModal(
        action === 'top-up'
          ? 'top-up your account'
          : action === 'swap'
            ? 'swap funds'
            : action === 'withdraw'
              ? 'withdraw funds'
              : action === 'account'
                ? 'view account details'
                : 'perform P2P transfers',
      );
      return;
    }
    if (action === 'top-up') router.push('/dashboard/wallet');
    else if (action === 'swap') router.push('/dashboard/wallets/swap');
    else if (action === 'withdraw') setShowWithdrawModal(true);
    else if (action === 'p2p') router.push('/dashboard/wallets/p2p');
    else router.push('/dashboard/wallet');
  };

  const myInvestments = useMemo(
    () => (investmentsData?.items ?? []).filter((i) => isActiveInvestmentStatus(i.status)),
    [investmentsData?.items],
  );
  const listings = useMemo(() => propertiesData?.items ?? [], [propertiesData?.items]);
  const listingCoverById = useMemo(
    () => new Map(listings.map((p) => [p.id, p.coverImageUrl ?? null] as const)),
    [listings],
  );
  const fractionalListings = useMemo(
    () => listings.filter((p) => resolveListingMode(p) === 'fractional').slice(0, 8),
    [listings],
  );
  const landListings = useMemo(
    () => listings.filter((p) => resolveListingMode(p) === 'land').slice(0, 8),
    [listings],
  );
  const ownHomeListings = useMemo(
    () => listings.filter((p) => resolveListingMode(p) === 'own-home').slice(0, 8),
    [listings],
  );

  const vaNotice = dashboardSummary ? getVirtualAccountWalletNotice(dashboardSummary.virtualAccount) : null;
  const pendingWd = dashboardSummary?.pendingWithdrawals;
  const showPendingWithdrawal = pendingWd && typeof pendingWd.count === 'number' && pendingWd.count > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-100 text-sm font-semibold text-dashboard-heading">
            {profileImage ? (
              <Image
                src={profileImage}
                alt={displayName}
                fill
                sizes="40px"
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-dashboard-heading">Hi {displayName} 👋</h1>
            <p className="text-sm font-normal text-dashboard-body">Welcome to investing for properties</p>
          </div>
        </div>
        <DashboardHeaderActions />
      </div>

      <div
        className="rounded-xl border border-dashboard-border bg-dashboard-card px-4 pb-5 pt-4"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowAccountsModal(true)}
            className="inline-flex items-center gap-2 rounded-full border border-dashboard-border bg-white px-4 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
              <span className="text-[12px] leading-none">
                {CURRENCIES.find((c) => c.code === selectedCurrency)?.flag}
              </span>
            </span>
            <span className="text-sm font-medium text-dashboard-heading">
              {CURRENCIES.find((c) => c.code === selectedCurrency)?.label}
            </span>
            <svg className="h-4 w-4 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          {balancesLoading ? (
            <div className="h-8 w-40 animate-pulse rounded bg-dashboard-border/50" />
          ) : (
            <p className="text-2xl font-bold tracking-tight text-dashboard-heading">{displayBalance}</p>
          )}
          <button
            type="button"
            onClick={() => setBalanceVisible((v) => !v)}
            className="shrink-0 rounded-lg p-1.5 hover:bg-dashboard-border/40"
            aria-label={balanceVisible ? 'Hide balance' : 'Show balance'}
          >
            {balanceVisible ? (
              <svg className="h-5 w-5 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            )}
          </button>
        </div>

        {showPendingWithdrawal ? (
          <div className="mt-3 flex justify-center">
            <Link
              href="/dashboard/wallet"
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-200/90 bg-amber-50 px-3 py-1.5 text-center text-[11px] font-medium text-amber-950"
            >
              <span className="truncate">
                {pendingWd.count} pending withdrawal{pendingWd.count === 1 ? '' : 's'}
                {pendingWd.totalNetAmount
                  ? ` · ${formatMoney(pendingWd.totalNetAmount, 'NGN')} net`
                  : null}
              </span>
            </Link>
          </div>
        ) : null}

        {vaNotice ? (
          <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-center text-xs leading-snug text-amber-950">
            {vaNotice}{' '}
            <Link href="/dashboard/wallet" className="font-semibold text-cohold-primary underline-offset-2 hover:underline">
              Wallet
            </Link>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-4 gap-4">
          {[
            { key: 'top-up', label: 'Top up', icon: PlusIcon, onClick: () => handleWalletAction('top-up') },
            { key: 'swap', label: 'Swap', icon: SwapIcon, onClick: () => handleWalletAction('swap') },
            { key: 'withdraw', label: 'Withdraw', icon: WithdrawIcon, onClick: () => handleWalletAction('withdraw') },
            { key: 'p2p', label: 'P2P', icon: P2PIcon, onClick: () => handleWalletAction('p2p') },
          ].map(({ key, label, icon: Icon, onClick }) => (
            <button
              key={key}
              type="button"
              onClick={onClick}
              aria-label={`${label} wallet action`}
              className="flex flex-col items-center gap-2"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cohold-primary text-white transition-opacity hover:bg-cohold-primary-hover hover:opacity-95">
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-xs font-medium text-dashboard-body">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <DashboardTodoShortcuts
        checklist={onboardingChecklist}
        isLoading={checklistLoading}
        isError={checklistError}
      />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-dashboard-heading">My investments</h2>
          <Link href="/dashboard/investments" className="text-sm font-normal text-dashboard-body">
            See all →
          </Link>
        </div>
        {investmentSummaryAside(dashboardSummary)}
        <ListingCarouselRow>
          {myInvestments.length === 0 ? (
            <EmptyState
              title="You do not have any investment yet."
              message="Click on the button below to find properties you can invest in, lands you can buy and homes you can own."
              icon={
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              }
              cta={{ label: 'Go to Listings', href: '/dashboard/properties' }}
              className="min-w-[280px] flex-1 rounded-xl p-6 shadow-sm"
            />
          ) : (
            myInvestments.slice(0, 8).map((inv) => {
              const cover = listingCoverById.get(inv.propertyId) ?? null;
              const prop = inv.property;
              const mode = prop ? resolveListingMode(prop) : 'fractional';
              const metaParts: string[] = [];
              if (prop) {
                const city = shortLocationForListingCard(prop);
                if (city) metaParts.push(city);
                if (mode === 'fractional') {
                  metaParts.push(formatAnnualYieldPercent(prop.annualYield));
                  metaParts.push(formatTermForListingCard(prop.termMonths));
                } else {
                  const sub = titleVerificationSubtitleForCard(prop.titleVerificationStatus);
                  if (sub) metaParts.push(sub);
                  metaParts.push('Monthly');
                }
              }
              return (
                <Link
                  key={inv.id}
                  href={`/dashboard/portfolio/${inv.id}`}
                  className={`${coholdUi.card} w-[260px] flex-shrink-0 snap-start`}
                >
                  <div className="relative h-32 bg-cohold-border/50">
                    {cover ? (
                      <Image
                        src={cover}
                        alt={prop?.title ?? 'Property'}
                        fill
                        sizes="260px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-cohold-muted">No image</div>
                    )}
                    {prop ? (
                      <div className="absolute left-2 top-2">
                        <CategoryPill listingType={prop.listingType} mode={mode} />
                      </div>
                    ) : null}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-semibold text-cohold-text">
                      {prop?.title ?? 'Property'}
                    </p>
                    {metaParts.length > 0 ? (
                      <p className="mt-1 text-xs text-cohold-muted">{metaParts.join('  ·  ')}</p>
                    ) : null}
                    <p className="mt-2 text-base font-bold text-cohold-text">
                      {formatMoney(investmentPositionValue(inv.amount, inv.totalReturns), inv.currency)}
                    </p>
                    <p className={`mt-1 ${coholdUi.riskNote}`}>
                      Position value (principal + paid distributions). Not guaranteed.
                    </p>
                  </div>
                </Link>
              );
            })
          )}
        </ListingCarouselRow>
      </section>

      <HomeListingSection
        title="Listings | Fractional ownership"
        seeAllHref="/dashboard/properties"
        properties={fractionalListings}
      />

      <HomeListingSection
        title="Listings | Land acquisition"
        seeAllHref="/dashboard/properties"
        properties={landListings}
        emptyMessage="No land listings yet"
      />

      <HomeListingSection
        title="Listings | Own a home"
        seeAllHref="/dashboard/properties"
        properties={ownHomeListings}
        emptyMessage="No own-a-home listings yet"
      />

      {showAccountsModal && (
        <AccountsModal
          balances={balances}
          selectedCurrency={selectedCurrency}
          onSelect={(c) => {
            setSelectedCurrency(c);
            setShowAccountsModal(false);
          }}
          onClose={() => setShowAccountsModal(false)}
        />
      )}
      {showWithdrawModal && (
        <WithdrawWalletModal
          open={showWithdrawModal}
          balance={selectedWallet?.balance ?? '0'}
          userEmail={userEmail}
          onClose={() => setShowWithdrawModal(false)}
          onWithdrawCreated={(id) => {
            setShowWithdrawModal(false);
            router.push(`/dashboard/wallets/withdraw/${id}`);
          }}
        />
      )}
      {showUnverifiedModal && (
        <UnverifiedActionModal action={showUnverifiedModal} onClose={() => setShowUnverifiedModal(null)} />
      )}
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}
function SwapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}
function WithdrawIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  );
}
function P2PIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function UnverifiedActionModal({ action, onClose }: { action: string; onClose: () => void }) {
  const title = action.includes('top-up')
    ? 'Top up'
    : action.includes('swap')
      ? 'Swap'
      : action.includes('withdraw')
        ? 'Withdraw'
        : action.includes('P2P')
          ? 'P2P transfers'
          : 'Action';

  const message = action.includes('top-up')
    ? 'You cannot top-up your account because you have not verified your account. Complete KYC to have total freedom.'
    : action.includes('swap')
      ? 'You cannot swap funds because you have not verified your account. Complete KYC to have total freedom.'
      : action.includes('withdraw')
        ? 'You cannot withdraw funds because you have not verified your account. Complete KYC to have total freedom.'
        : action.includes('P2P')
          ? 'You cannot perform P2P transfers because you have not verified your account. Complete KYC to have total freedom.'
          : `You cannot ${action} until you verify your account. Complete KYC to continue.`;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center sm:p-4">
      <div className="mx-auto w-full max-w-md rounded-t-2xl bg-dashboard-card p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-2 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-dashboard-border/50"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <EmptyState
          variant="modal"
          title={title}
          message={message}
          icon={
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11V7a4 4 0 10-8 0v4" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 11V7a4 4 0 00-8 0v4" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 11h16v10H4V11z" />
            </svg>
          }
          cta={{ label: 'Verify my account', href: '/dashboard/kyc' }}
          className="mt-2"
        />
      </div>
    </div>
  );
}
