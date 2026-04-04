'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardHeaderActions } from '@/components/dashboard/DashboardHeaderActions';
import {
  useWalletBalances,
  useVirtualAccounts,
  formatMoney,
  type WalletBalance,
  type VirtualAccount,
} from '@/lib/hooks/use-wallet';
import { useMyInvestments } from '@/lib/hooks/use-investments';
import { investmentPositionValue, isActiveInvestmentStatus } from '@/lib/money/portfolio';
import { useProperties } from '@/lib/hooks/use-properties';
import { useMe } from '@/lib/hooks/use-onboarding';
import { useAuthStore } from '@/stores/auth.store';
import { EmptyState } from '@/components/dashboard/EmptyState';

const CURRENCIES: Array<{ code: 'NGN' | 'USD' | 'GBP' | 'EUR'; flag: string; label: string }> = [
  { code: 'NGN', flag: '🇳🇬', label: 'NGN Account' },
  { code: 'USD', flag: '🇺🇸', label: 'USD Account' },
  { code: 'GBP', flag: '🇬🇧', label: 'GBP Account' },
  { code: 'EUR', flag: '🇪🇺', label: 'EUR Account' },
];

function useCopyToClipboard() {
  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);
  return copy;
}

export default function HomeDashboardPage() {
  const router = useRouter();
  const userFromStore = useAuthStore((s) => s.user);
  const { data: me } = useMe();
  const { data: balances = [], isLoading: balancesLoading } = useWalletBalances();
  const { data: virtualAccounts = [] } = useVirtualAccounts();
  const { data: investmentsData } = useMyInvestments();
  const { data: propertiesData } = useProperties(1, 10);

  const displayName = me?.firstName || userFromStore?.firstName || 'User';
  const initials = [me?.firstName?.[0], me?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || (userFromStore?.email?.[0] ?? 'U').toUpperCase();
  const meIsVerified = me?.kycStatus === 'VERIFIED' && !!me?.onboardingCompletedAt;
  const storeIsVerified =
    userFromStore?.kycStatus === 'VERIFIED' && !!userFromStore?.onboardingCompletedAt;
  const isVerified = meIsVerified || storeIsVerified;

  const [selectedCurrency, setSelectedCurrency] = useState<'NGN' | 'USD' | 'GBP' | 'EUR'>('NGN');
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showAccountDetails, setShowAccountDetails] = useState(false);
  const [showUnverifiedModal, setShowUnverifiedModal] = useState<string | null>(null);

  const selectedWallet = balances.find((w) => w.currency === selectedCurrency);
  const rawBalance = selectedWallet ? formatMoney(selectedWallet.balance, selectedCurrency) : '₦0.00';
  const displayBalance = balanceVisible ? rawBalance : '•••••';
  const ngnVirtualAccount = virtualAccounts.find((va) => va.currency === 'NGN');
  const cardPreview = ngnVirtualAccount
    ? `•••• ${ngnVirtualAccount.accountNumber.slice(-4)}`
    : '•••• ----';

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
                : 'perform P2P transfers'
      );
      return;
    }
    if (action === 'top-up') router.push('/dashboard/wallet');
    else if (action === 'swap') router.push('/dashboard/wallets/swap');
    else if (action === 'withdraw') setShowWithdrawModal(true);
    else if (action === 'p2p') router.push('/dashboard/wallets/p2p');
    else setShowAccountDetails(true);
  };

  const myInvestments = useMemo(
    () => (investmentsData?.items ?? []).filter((i) => isActiveInvestmentStatus(i.status)),
    [investmentsData?.items],
  );
  const listings = propertiesData?.items ?? [];
  const fractionalListings = listings.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Header: avatar, greeting, tagline, notification */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-full bg-amber-100 flex items-center justify-center text-dashboard-heading font-semibold text-sm">
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-dashboard-heading truncate">Hi {displayName} 👋</h1>
            <p className="text-sm font-normal text-dashboard-body">Welcome to investing for properties</p>
          </div>
        </div>
        <DashboardHeaderActions />
      </div>

      {/* Wallet card (Figma): centered account pill, centered balance + eye, compact virtual account pill */}
      <div
        className="rounded-2xl bg-dashboard-card border border-dashboard-border px-4 pt-4 pb-5"
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
            <span className="text-sm font-medium text-dashboard-heading">{CURRENCIES.find((c) => c.code === selectedCurrency)?.label}</span>
            <svg className="h-4 w-4 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          {balancesLoading ? (
            <div className="h-8 w-40 bg-dashboard-border/50 rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-dashboard-heading tracking-tight">{displayBalance}</p>
          )}
          <button
            type="button"
            onClick={() => setBalanceVisible((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-dashboard-border/40 shrink-0"
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

        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => handleWalletAction('account')}
            className="inline-flex items-center gap-3 rounded-full border border-dashboard-border bg-white px-4 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-dashboard-border/20 transition-colors"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-dashboard-bg">
              <svg className="h-4 w-4 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </span>
            <span className="flex flex-col text-left">
              <span className="text-sm font-medium text-dashboard-heading leading-5">Account details</span>
              <span className="text-[11px] font-normal text-dashboard-body leading-4">{cardPreview}</span>
            </span>
            <svg className="h-5 w-5 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Quick actions (inside wallet card) */}
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
              className="flex flex-col items-center gap-2"
            >
              <div className="h-12 w-12 rounded-full bg-cohold-blue flex items-center justify-center text-white hover:opacity-90 transition-opacity">
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-xs font-medium text-dashboard-heading">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* To-dos */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-normal text-dashboard-body">To-dos</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            {
              key: 'kyc',
              title: isVerified ? 'Make your first investment' : 'Complete your KYC',
              subtitle: isVerified ? '' : '',
              href: isVerified ? '/dashboard/properties' : '/dashboard/kyc',
              icon: (
                <svg className="h-6 w-6 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {isVerified ? (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 21V7a2 2 0 012-2h10a2 2 0 012 2v14" />
                    </>
                  ) : (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11V7a4 4 0 00-8 0v4" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 11V7a4 4 0 00-8 0v4" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 11h14v10H5V11z" />
                    </>
                  )}
                </svg>
              ),
            },
            {
              key: 'invest',
              title: 'Make your first investment',
              href: '/dashboard/properties',
              icon: (
                <svg className="h-6 w-6 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5 5 5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14" />
                </svg>
              ),
            },
            {
              key: 'land',
              title: 'Buy your first land',
              href: '/dashboard/properties',
              icon: (
                <svg className="h-6 w-6 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10l9-7 9 7" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 10v10h10V10" />
                </svg>
              ),
            },
          ].map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className="rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-3 flex flex-col gap-3"
            >
              <div className="h-11 w-11 rounded-xl bg-dashboard-border/10 flex items-center justify-center">
                {t.icon}
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-dashboard-heading leading-4 line-clamp-2">{t.title}</p>
                <svg className="h-4 w-4 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* My Investments: horizontal carousel, card radius 12px, font hierarchy */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-dashboard-heading">My investments</h2>
          <Link href="/dashboard/investments" className="text-sm font-normal text-dashboard-body">
            See all →
          </Link>
        </div>
        <div className="overflow-x-auto pb-2 -mx-4 px-4 flex gap-3 snap-x snap-mandatory">
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
              className="flex-1 min-w-[280px] rounded-xl p-6 shadow-sm"
            />
          ) : (
            myInvestments.slice(0, 5).map((inv) => (
              <Link
                key={inv.id}
                href={`/dashboard/portfolio/${inv.id}`}
                className="flex-shrink-0 w-[280px] snap-start rounded-xl border border-dashboard-border bg-dashboard-card overflow-hidden shadow-sm hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow"
              >
                <div className="h-36 bg-dashboard-border/50 flex items-center justify-center rounded-t-xl">
                  <svg className="h-12 w-12 text-dashboard-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-dashboard-heading line-clamp-2">{inv.property?.title ?? 'Property'}</p>
                  <p className="text-xs font-normal text-dashboard-body mt-1">{inv.property?.location ?? '—'}</p>
                  <p className="text-sm font-semibold text-dashboard-heading mt-2">
                    {formatMoney(investmentPositionValue(inv.amount, inv.totalReturns), inv.currency)}
                  </p>
                  <p className="text-[10px] text-dashboard-muted">Position value (principal + returns)</p>
                  <p className="text-xs font-normal text-dashboard-muted mt-0.5">{inv.status}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* Listings: vertical grid, Active badge, typography hierarchy */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-dashboard-heading">Listings | Fractional ownership</h2>
          <Link href="/dashboard/properties" className="text-sm font-normal text-dashboard-body">
            See all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {fractionalListings.length === 0 ? (
            <div className="col-span-2 rounded-xl border border-dashboard-border bg-dashboard-card p-6 text-center shadow-sm">
              <p className="text-sm font-normal text-dashboard-body">No listings yet</p>
            </div>
          ) : (
            fractionalListings.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/properties/${p.id}`}
                className="rounded-xl border border-dashboard-border bg-dashboard-card overflow-hidden shadow-sm hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow flex flex-col"
              >
                <div className="relative h-32 bg-dashboard-border/50 rounded-t-xl">
                  <span className="absolute left-2 top-2 rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-medium text-white">
                    Active ⚡
                  </span>
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  <p className="text-sm font-semibold text-dashboard-heading line-clamp-2">{p.title}</p>
                  <p className="text-xs font-normal text-dashboard-body mt-1 line-clamp-1">{p.location}</p>
                  <div className="mt-auto pt-2 flex items-center justify-end">
                    <span className="rounded-lg bg-cohold-blue text-white text-xs font-medium px-3 py-1.5">
                      Invest
                    </span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* Modals */}
      {showAccountsModal && (
        <AccountSelectionModal
          balances={balances}
          selectedCurrency={selectedCurrency}
          onSelect={(c) => { setSelectedCurrency(c); setShowAccountsModal(false); }}
          onClose={() => setShowAccountsModal(false)}
        />
      )}
      {showTopUpModal && <TopUpModal virtualAccount={ngnVirtualAccount} accountName={displayName} onClose={() => setShowTopUpModal(false)} />}
      {showWithdrawModal && (
        <WithdrawModal
          balance={selectedWallet?.balance ?? '0'}
          currency={selectedCurrency}
          onClose={() => setShowWithdrawModal(false)}
        />
      )}
      {showAccountDetails && (
        isVerified ? (
          <AccountDetailsModal virtualAccount={ngnVirtualAccount} accountName={displayName} onClose={() => setShowAccountDetails(false)} />
        ) : (
          <UnverifiedAccountModal onClose={() => setShowAccountDetails(false)} />
        )
      )}
      {showUnverifiedModal && (
        <UnverifiedActionModal action={showUnverifiedModal} onClose={() => setShowUnverifiedModal(null)} />
      )}
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
}
function SwapIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>;
}
function WithdrawIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>;
}
function P2PIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
}

function AccountSelectionModal({
  balances,
  selectedCurrency,
  onSelect,
  onClose,
}: {
  balances: WalletBalance[];
  selectedCurrency: string;
  onSelect: (c: 'NGN' | 'USD' | 'GBP' | 'EUR') => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50 sm:items-center sm:p-4">
      <div className="bg-dashboard-card rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-dashboard-heading">My accounts</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-dashboard-border/50">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="space-y-3">
          {CURRENCIES.map((curr) => {
            const w = balances.find((b) => b.currency === curr.code);
            const balance = w ? formatMoney(w.balance, curr.code) : '0.00';
            const isSelected = selectedCurrency === curr.code;
            return (
              <button
                key={curr.code}
                type="button"
                onClick={() => onSelect(curr.code)}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-dashboard-border hover:bg-dashboard-border/30 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{curr.flag}</span>
                  <div>
                    <p className="font-medium text-dashboard-heading">{curr.label}</p>
                    <p className="text-sm text-dashboard-body">{balance}</p>
                  </div>
                </div>
                {isSelected && (
                  <div className="h-5 w-5 rounded-full border-2 border-cohold-blue flex items-center justify-center">
                    <div className="h-3 w-3 rounded-full bg-cohold-blue" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CopyRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-dashboard-border last:border-0">
      <span className="text-sm text-dashboard-body">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-dashboard-heading">{value}</span>
        <button type="button" onClick={onCopy} className="p-1.5 rounded hover:bg-dashboard-border/50" aria-label="Copy">
          <svg className="h-4 w-4 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function TopUpModal({ virtualAccount, accountName, onClose }: { virtualAccount: VirtualAccount | undefined; accountName: string; onClose: () => void }) {
  const copy = useCopyToClipboard();
  const accountNumber = virtualAccount?.accountNumber ?? '—';
  const bankName = virtualAccount?.bankName ?? '—';
  const name = virtualAccount?.accountName ?? accountName;

  const copyAll = () => {
    copy(`${accountNumber}\n${bankName}\n${name}`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50 sm:items-center sm:p-4">
      <div className="bg-dashboard-card rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-dashboard-heading">Top up</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-dashboard-border/50">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="rounded-xl border border-dashboard-border bg-cohold-icon-bg/50 p-4 space-y-0">
          <CopyRow label="Account number" value={accountNumber} onCopy={() => copy(accountNumber)} />
          <CopyRow label="Bank name" value={bankName} onCopy={() => copy(bankName)} />
          <CopyRow label="Account name" value={name} onCopy={() => copy(name)} />
        </div>
        <button type="button" onClick={copyAll} className="mt-4 w-full rounded-xl bg-cohold-blue text-white py-3 font-medium hover:opacity-90">
          Copy all
        </button>
      </div>
    </div>
  );
}

function WithdrawModal({ balance, currency, onClose }: { balance: string; currency: string; onClose: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState('100000');
  const [showOtp, setShowOtp] = useState(false);

  if (showOtp) {
    return (
      <OtpModal
        purpose="withdrawal"
        onComplete={() => {
          setShowOtp(false);
          onClose();
          router.push(`/dashboard/wallets/withdraw/success?amount=${encodeURIComponent(amount)}`);
        }}
        onClose={() => setShowOtp(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50 sm:items-center sm:p-4">
      <div className="bg-dashboard-card rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6 shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-dashboard-heading">Withdraw</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-dashboard-border/50">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-dashboard-body mb-2 block">Withdrawal amount</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                className="flex-1 rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-dashboard-heading"
              />
              <span className="rounded-lg border border-dashboard-border px-3 py-2.5 text-sm font-medium text-dashboard-heading">{currency}</span>
            </div>
            <p className="text-xs text-dashboard-body mt-1">Balance {formatMoney(balance, currency)}</p>
          </div>
          <div>
            <label className="text-sm text-dashboard-body mb-2 block">Recipient account</label>
            <p className="text-sm text-dashboard-muted">Add an account to withdraw to your bank.</p>
            <Link href="/dashboard/account/recipients" className="text-sm font-medium text-cohold-blue mt-2 inline-block">Add an account →</Link>
          </div>
          <button
            type="button"
            onClick={() => setShowOtp(true)}
            className="w-full rounded-xl bg-cohold-blue text-white py-3 font-medium hover:opacity-90"
          >
            Withdraw
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountDetailsModal({ virtualAccount, accountName, onClose }: { virtualAccount: VirtualAccount | undefined; accountName: string; onClose: () => void }) {
  const copy = useCopyToClipboard();
  const accountNumber = virtualAccount?.accountNumber ?? '—';
  const bankName = virtualAccount?.bankName ?? '—';
  const name = virtualAccount?.accountName ?? accountName;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50 sm:items-center sm:p-4">
      <div className="bg-dashboard-card rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-dashboard-heading">Account details</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-dashboard-border/50">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="rounded-xl border border-dashboard-border bg-cohold-icon-bg/50 p-4 space-y-0">
          <CopyRow label="Account number" value={accountNumber} onCopy={() => copy(accountNumber)} />
          <CopyRow label="Bank name" value={bankName} onCopy={() => copy(bankName)} />
          <CopyRow label="Account name" value={name} onCopy={() => copy(name)} />
        </div>
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-xl bg-cohold-blue text-white py-3 font-medium hover:opacity-90">
          Close
        </button>
      </div>
    </div>
  );
}

function UnverifiedAccountModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50 sm:items-center sm:p-4">
      <div className="bg-dashboard-card rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6 shadow-xl">
        <div className="flex items-center justify-end mb-2">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dashboard-border/50"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <EmptyState
          variant="modal"
          title="Account details"
          message="Your account has not been verified. Complete KYC to see account details."
          icon={
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 21a7.5 7.5 0 00-15 0" />
            </svg>
          }
          cta={{ label: 'Verify my account', href: '/dashboard/kyc' }}
          className="mt-2"
        />
      </div>
    </div>
  );
}

function UnverifiedActionModal({ action, onClose }: { action: string; onClose: () => void }) {
  const title =
    action.includes('top-up') ? 'Top up' :
    action.includes('swap') ? 'Swap' :
    action.includes('withdraw') ? 'Withdraw' :
    action.includes('P2P') ? 'P2P transfers' :
    'Action';

  const message =
    action.includes('top-up')
      ? 'You cannot top-up your account because you have not verified your account. Complete KYC to have total freedom.'
      : action.includes('swap')
        ? 'You cannot swap funds because you have not verified your account. Complete KYC to have total freedom.'
        : action.includes('withdraw')
          ? 'You cannot withdraw funds because you have not verified your account. Complete KYC to have total freedom.'
          : action.includes('P2P')
            ? 'You cannot perform P2P transfers because you have not verified your account. Complete KYC to have total freedom.'
            : `You cannot ${action} until you verify your account. Complete KYC to continue.`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50 sm:items-center sm:p-4">
      <div className="bg-dashboard-card rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6 shadow-xl">
        <div className="flex items-center justify-end mb-2">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dashboard-border/50"
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

function OtpModal({ onComplete, onClose }: { purpose: 'withdrawal'; onComplete: () => void; onClose: () => void }) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useState<(HTMLInputElement | null)[]>([])[0];

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) inputRefs[index + 1]?.focus();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50 sm:items-center sm:p-4">
      <div className="bg-dashboard-card rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-dashboard-heading">OTP Code</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-dashboard-border/50">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <p className="text-sm text-dashboard-body mb-4">A 6-digit OTP has been sent to your email. Enter the code to complete withdrawal.</p>
        <div className="flex justify-center gap-2 mb-6">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { (inputRefs as (HTMLInputElement | null)[])[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              className="h-12 w-12 rounded-xl border-2 border-dashboard-border text-center text-lg font-semibold focus:border-cohold-blue focus:outline-none"
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => otp.join('').length === 6 && onComplete()}
          disabled={otp.join('').length !== 6}
          className="w-full rounded-xl bg-cohold-blue text-white py-3 font-medium disabled:opacity-50"
        >
          Complete withdrawal
        </button>
      </div>
    </div>
  );
}
