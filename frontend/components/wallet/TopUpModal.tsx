'use client';

import { useCallback } from 'react';
import { WalletModalShell } from '@/components/wallet/WalletModalShell';
import { CopyDetailRow } from '@/components/wallet/CopyDetailRow';
import type { VirtualAccount } from '@/lib/hooks/use-wallet';

type TopUpModalProps = {
  virtualAccount: VirtualAccount | undefined;
  fallbackAccountName: string;
  onClose: () => void;
};

export function TopUpModal({ virtualAccount, fallbackAccountName, onClose }: TopUpModalProps) {
  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }, []);

  const accountNumber = virtualAccount?.accountNumber ?? '—';
  const bankName = virtualAccount?.bankName ?? '—';
  const name = virtualAccount?.accountName ?? fallbackAccountName;

  const copyAll = () => {
    if (!virtualAccount) return;
    void copy(`${accountNumber}\n${bankName}\n${name}`);
  };

  return (
    <WalletModalShell title="Top up" onClose={onClose}>
      <div className="rounded-xl border border-dashboard-border bg-dashboard-bg/80 px-1">
        <CopyDetailRow label="Account number" value={accountNumber} onCopy={() => copy(accountNumber)} />
        <CopyDetailRow label="Bank name" value={bankName} onCopy={() => copy(bankName)} />
        <CopyDetailRow label="Account name" value={name} onCopy={() => copy(name)} />
      </div>
      {!virtualAccount ? (
        <p className="mt-3 text-center text-xs text-dashboard-body">
          Your dedicated virtual account is not ready yet. Please check back later or contact support.
        </p>
      ) : null}
      <button
        type="button"
        onClick={copyAll}
        disabled={!virtualAccount}
        className="mt-5 w-full rounded-xl bg-cohold-blue py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Copy all
      </button>
    </WalletModalShell>
  );
}
