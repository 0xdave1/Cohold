'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import Decimal from 'decimal.js';
import { WalletModalShell } from '@/components/wallet/WalletModalShell';
import { useLinkedBanks } from '@/lib/hooks/use-linked-banks';
import { useCreateWithdrawal } from '@/lib/hooks/use-withdrawals';
import { useAuth } from '@/lib/hooks/use-auth';
import { formatMoney } from '@/lib/hooks/use-wallet';
import { getApiErrorMessage } from '@/lib/api/errors';

function BankBuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
    </svg>
  );
}

type Step = 'form' | 'otp';

type WithdrawWalletModalProps = {
  open: boolean;
  onClose: () => void;
  balance: string;
  userEmail: string;
  onWithdrawCreated: (withdrawalId: string) => void;
};

function toApiAmount(raw: string): string | null {
  if (!raw || raw === '.') return null;
  try {
    const d = new Decimal(raw);
    if (d.lte(0)) return null;
    return d.toDecimalPlaces(4, Decimal.ROUND_DOWN).toFixed();
  } catch {
    return null;
  }
}

export function WithdrawWalletModal({
  open,
  onClose,
  balance,
  userEmail,
  onWithdrawCreated,
}: WithdrawWalletModalProps) {
  const { data: banks = [], isLoading: banksLoading } = useLinkedBanks();
  const { requestOtp } = useAuth();
  const createWithdrawal = useCreateWithdrawal();

  const [step, setStep] = useState<Step>('form');
  const [amountRaw, setAmountRaw] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSending, setOtpSending] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!open) {
      setStep('form');
      setAmountRaw('');
      setSelectedBankId('');
      setFormError(null);
      setOtpError(null);
      setOtp(['', '', '', '', '', '']);
      setOtpSending(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || banks.length === 0) return;
    const def = banks.find((b) => b.isDefault) ?? banks[0];
    setSelectedBankId((id) => id || def.id);
  }, [open, banks]);

  const onAmountChange = (v: string) => {
    const cleaned = v.replace(/[^\d.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 4) return;
    setAmountRaw(cleaned);
    setFormError(null);
  };

  const validateForm = useCallback((): string | null => {
    const apiAmount = toApiAmount(amountRaw);
    if (!apiAmount) return 'Enter a valid amount greater than zero.';
    if (!selectedBankId) return 'Select a recipient bank account.';
    let amt: Decimal;
    let bal: Decimal;
    try {
      amt = new Decimal(apiAmount);
      bal = new Decimal(balance);
    } catch {
      return 'Invalid amount.';
    }
    if (amt.gt(bal)) return 'Insufficient wallet balance.';
    return null;
  }, [amountRaw, balance, selectedBankId]);

  const goToOtp = async () => {
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }
    if (!userEmail?.trim()) {
      setFormError('Your account email is missing. Please sign in again.');
      return;
    }
    setFormError(null);
    setOtpError(null);
    setOtpSending(true);
    try {
      await requestOtp.mutateAsync({ email: userEmail.trim(), purpose: 'transaction' });
      setStep('otp');
    } catch (e) {
      setFormError(getApiErrorMessage(e, 'Could not send OTP. Try again.'));
    } finally {
      setOtpSending(false);
    }
  };

  const submitWithdrawal = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setOtpError('Enter the 6-digit code from your email.');
      return;
    }
    const apiAmount = toApiAmount(amountRaw);
    if (!apiAmount || !selectedBankId) {
      setOtpError('Invalid amount or bank. Go back and check your details.');
      return;
    }
    setOtpError(null);
    try {
      const created = await createWithdrawal.mutateAsync({
        linkedBankAccountId: selectedBankId,
        amount: apiAmount,
        currency: 'NGN',
        otp: code,
      });
      onWithdrawCreated(created.id);
    } catch (e) {
      setOtpError(getApiErrorMessage(e, 'Withdrawal could not be completed.'));
    }
  };

  const handleOtpDigit = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    setOtpError(null);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  if (!open) return null;

  if (step === 'otp') {
    return (
      <WalletModalShell title="OTP Code" onClose={onClose}>
        <p className="mb-5 text-sm leading-relaxed text-dashboard-body">
          A 6-digit OTP has been sent to your email. Enter the code to verify and submit your withdrawal.
        </p>
        <p className="mb-2 text-xs font-medium text-dashboard-heading">OTP Code</p>
        <div className="mb-2 flex items-center justify-center gap-1.5 sm:gap-2">
          {otp.map((digit, i) => (
            <div key={i} className="flex items-center">
              <input
                ref={(el) => {
                  otpRefs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpDigit(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
                }}
                className="h-12 w-10 rounded-xl border-2 border-dashboard-border text-center text-lg font-semibold text-dashboard-heading focus:border-cohold-blue focus:outline-none sm:h-12 sm:w-11"
              />
              {i === 2 ? (
                <span className="mx-0.5 text-lg font-light text-dashboard-body/50" aria-hidden>
                  -
                </span>
              ) : null}
            </div>
          ))}
        </div>
        {otpError ? (
          <p className="mb-3 text-center text-xs text-red-600" role="alert">
            {otpError}
          </p>
        ) : (
          <div className="mb-3 h-4" />
        )}
        <button
          type="button"
          onClick={() => {
            setStep('form');
            setOtpError(null);
          }}
          className="mb-3 w-full text-center text-xs font-medium text-cohold-blue underline"
        >
          Back to amount & recipient
        </button>
        <button
          type="button"
          onClick={submitWithdrawal}
          disabled={createWithdrawal.isPending || otp.join('').length !== 6}
          className="w-full rounded-xl bg-cohold-blue py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {createWithdrawal.isPending ? 'Submitting…' : 'Complete withdrawal'}
        </button>
      </WalletModalShell>
    );
  }

  return (
    <WalletModalShell title="Withdraw" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm text-dashboard-body">Withdrawal amount</label>
          <div className="flex items-stretch gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={amountRaw}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="0.00"
              className="min-w-0 flex-1 rounded-xl border border-dashboard-border bg-white px-3 py-2.5 text-dashboard-heading outline-none focus:border-cohold-blue focus:ring-1 focus:ring-cohold-blue"
            />
            <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-dashboard-border bg-white px-3 py-2.5 text-sm font-semibold text-dashboard-heading">
              <span aria-hidden>🇳🇬</span>
              <span>NGN</span>
            </div>
          </div>
          <p className="mt-1.5 text-xs text-dashboard-body">
            Balance: <span className="font-medium text-dashboard-heading">{formatMoney(balance, 'NGN')}</span>
          </p>
          {toApiAmount(amountRaw) ? (
            <p className="mt-0.5 text-[11px] text-dashboard-body/70">
              ≈ {formatMoney(toApiAmount(amountRaw)!, 'NGN')}
            </p>
          ) : null}
        </div>

        <div>
          <p className="mb-2 text-sm text-dashboard-body">Recipient account</p>
          {banksLoading ? (
            <div className="h-24 animate-pulse rounded-xl bg-dashboard-border/50" />
          ) : banks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-dashboard-border bg-dashboard-bg/60 p-4 text-center">
              <p className="text-sm text-dashboard-body">No linked bank accounts yet.</p>
              <Link
                href="/dashboard/account/linked-banks/add"
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-cohold-blue"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashboard-border bg-white text-lg leading-none">
                  +
                </span>
                Add an account
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className="max-h-52 space-y-2 overflow-y-auto pr-0.5">
              {banks.map((b) => {
                const selected = b.id === selectedBankId;
                const subtitle = `${b.accountName} | ${b.bankName}`;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelectedBankId(b.id);
                      setFormError(null);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? 'border-cohold-blue bg-[#EAF3FA]'
                        : 'border-dashboard-border bg-white hover:bg-dashboard-border/20'
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-dashboard-border/40 text-dashboard-heading">
                      <BankBuildingIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-medium text-dashboard-heading">{b.accountNumber}</p>
                      <p className="truncate text-xs text-dashboard-body">{subtitle}</p>
                      {b.isVerified === false ? (
                        <p className="mt-1 text-[11px] text-amber-700">Unverified account (not eligible for withdrawal)</p>
                      ) : null}
                    </div>
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        selected ? 'border-cohold-blue' : 'border-dashboard-border'
                      }`}
                      aria-hidden
                    >
                      {selected ? <span className="h-3 w-3 rounded-full bg-cohold-blue" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {banks.length > 0 ? (
            <Link
              href="/dashboard/account/linked-banks/add"
              className="mt-3 flex w-full items-center justify-between rounded-xl border border-dashboard-border bg-white px-3 py-3 text-sm font-medium text-dashboard-heading hover:bg-dashboard-border/20"
            >
              <span className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashboard-border text-lg leading-none">
                  +
                </span>
                Add an account
              </span>
              <svg className="h-4 w-4 text-dashboard-body" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ) : null}
        </div>

        {formError ? (
          <p className="text-center text-xs text-red-600" role="alert">
            {formError}
          </p>
        ) : null}

        <button
          type="button"
          onClick={goToOtp}
          disabled={
            otpSending ||
            banks.length === 0 ||
            !amountRaw ||
            !banks.find((bank) => bank.id === selectedBankId)?.isVerified
          }
          className="w-full rounded-xl bg-cohold-blue py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {otpSending ? 'Sending code…' : 'Withdraw'}
        </button>
      </div>
    </WalletModalShell>
  );
}
