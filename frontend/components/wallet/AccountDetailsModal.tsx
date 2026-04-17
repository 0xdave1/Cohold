'use client';

import { useCallback } from 'react';
import { WalletModalShell } from '@/components/wallet/WalletModalShell';
import { CopyDetailRow } from '@/components/wallet/CopyDetailRow';
import type { VirtualAccount } from '@/lib/hooks/use-wallet';

type AccountDetailsModalProps = {
  virtualAccount: VirtualAccount | undefined;
  fallbackAccountName: string;
  onClose: () => void;
};

export function AccountDetailsModal({
  virtualAccount,
  fallbackAccountName,
  onClose,
}: AccountDetailsModalProps) {
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

  return (
    <WalletModalShell
      title="Account details"
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-cohold-blue py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Close
        </button>
      }
    >
      <div className="rounded-xl border border-dashboard-border bg-dashboard-bg/80 px-1">
        <CopyDetailRow label="Account number" value={accountNumber} onCopy={() => copy(accountNumber)} />
        <CopyDetailRow label="Bank name" value={bankName} onCopy={() => copy(bankName)} />
        <CopyDetailRow label="Account name" value={name} onCopy={() => copy(name)} />
      </div>
      {!virtualAccount ? (
        <p className="mt-3 text-center text-xs text-dashboard-body">
          Virtual account details are not available yet. Try again after your NGN account is provisioned.
        </p>
      ) : null}
    </WalletModalShell>
  );
}
