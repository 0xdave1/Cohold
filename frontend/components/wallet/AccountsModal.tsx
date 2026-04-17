'use client';

import { WalletModalShell } from '@/components/wallet/WalletModalShell';
import { formatMoney, type WalletBalance } from '@/lib/hooks/use-wallet';

const NGN = { code: 'NGN' as const, flag: '🇳🇬', label: 'NGN Account' };

type AccountsModalProps = {
  balances: WalletBalance[];
  selectedCurrency: 'NGN';
  onSelect: (c: 'NGN') => void;
  onClose: () => void;
};

export function AccountsModal({ balances, selectedCurrency, onSelect, onClose }: AccountsModalProps) {
  const w = balances.find((b) => b.currency === NGN.code);
  const balance = w ? formatMoney(w.balance, NGN.code) : '₦0.00';
  const isSelected = selectedCurrency === NGN.code;

  return (
    <WalletModalShell title="My accounts" onClose={onClose}>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onSelect('NGN')}
          className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors ${
            isSelected
              ? 'border-cohold-blue bg-[#EAF3FA]'
              : 'border-dashboard-border hover:bg-dashboard-border/30'
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-2xl" aria-hidden>
              {NGN.flag}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-dashboard-heading">{NGN.label}</p>
              <p className="text-sm text-dashboard-body">{balance}</p>
            </div>
          </div>
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
              isSelected ? 'border-cohold-blue' : 'border-dashboard-border'
            }`}
            aria-hidden
          >
            {isSelected ? <span className="h-3 w-3 rounded-full bg-cohold-blue" /> : null}
          </span>
        </button>
        <p className="px-1 pt-1 text-xs text-dashboard-body/80">
          Other currencies are not available for wallet actions yet.
        </p>
      </div>
    </WalletModalShell>
  );
}
