'use client';

import type { ReactNode } from 'react';
import { DedicatedAccountPill } from '@/components/wallet/DedicatedAccountPill';
import type { DedicatedAccountPillState } from '@/lib/wallet/dedicated-account-display';
const CURRENCIES: Array<{ code: 'NGN'; flag: string; label: string }> = [
  { code: 'NGN', flag: '🇳🇬', label: 'NGN Account' },
];

type WalletAction = 'top-up' | 'swap' | 'withdraw' | 'p2p';

type WalletBalanceCardProps = {
  balancesLoading: boolean;
  selectedCurrency: 'NGN';
  balanceVisible: boolean;
  displayBalance: string;
  dedicatedAccountPill: DedicatedAccountPillState;
  onDedicatedAccountPillClick?: () => void;
  onToggleBalanceVisible: () => void;
  onOpenAccountsModal: () => void;
  onWalletAction: (action: WalletAction) => void;
  pendingWithdrawalSlot?: ReactNode;
};

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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

export function WalletBalanceCard({
  balancesLoading,
  selectedCurrency,
  balanceVisible,
  displayBalance,
  dedicatedAccountPill,
  onDedicatedAccountPillClick,
  onToggleBalanceVisible,
  onOpenAccountsModal,
  onWalletAction,
  pendingWithdrawalSlot,
}: WalletBalanceCardProps) {
  const currencyMeta = CURRENCIES.find((c) => c.code === selectedCurrency);

  return (
    <div
      className="rounded-2xl border border-dashboard-border bg-dashboard-card px-4 pb-5 pt-4"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
    >
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onOpenAccountsModal}
          className="inline-flex items-center gap-2 rounded-full border border-dashboard-border bg-white px-4 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
            <span className="text-[12px] leading-none">{currencyMeta?.flag}</span>
          </span>
          <span className="text-sm font-medium text-dashboard-heading">{currencyMeta?.label}</span>
          <svg className="h-4 w-4 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        {balancesLoading ? (
          <div className="h-8 w-40 animate-pulse rounded bg-dashboard-border/50" />
        ) : (
          <p className="text-2xl font-bold tracking-tight text-[#171717]">{displayBalance}</p>
        )}
        <button
          type="button"
          onClick={onToggleBalanceVisible}
          className="shrink-0 rounded-lg p-1.5 hover:bg-dashboard-border/40"
          aria-label={balanceVisible ? 'Hide balance' : 'Show balance'}
        >
          {balanceVisible ? (
            <svg className="h-5 w-5 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
              />
            </svg>
          )}
        </button>
      </div>

      <div className="mt-3 flex justify-center">
        <DedicatedAccountPill state={dedicatedAccountPill} onClick={onDedicatedAccountPillClick} />
      </div>

      {pendingWithdrawalSlot ? <div className="mt-3 flex justify-center">{pendingWithdrawalSlot}</div> : null}

      <div className="mt-4 grid grid-cols-4 gap-4">
        {[
          { key: 'top-up', label: 'Top up', icon: PlusIcon, onClick: () => onWalletAction('top-up') },
          { key: 'swap', label: 'Swap', icon: SwapIcon, onClick: () => onWalletAction('swap') },
          { key: 'withdraw', label: 'Withdraw', icon: WithdrawIcon, onClick: () => onWalletAction('withdraw') },
          { key: 'p2p', label: 'P2P', icon: P2PIcon, onClick: () => onWalletAction('p2p') },
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
  );
}
