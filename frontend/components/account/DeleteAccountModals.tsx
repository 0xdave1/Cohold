'use client';

import { useState } from 'react';
import { useRequestDeleteAccountOtp, useDeleteAccount } from '@/lib/hooks/use-account';
import { getApiErrorMessage } from '@/lib/api/errors';

interface DeleteAccountModalsProps {
  onClose: () => void;
  userEmail: string;
}

export function DeleteAccountModals({ onClose, userEmail }: DeleteAccountModalsProps) {
  const [step, setStep] = useState<'confirm' | 'email' | 'otp'>('confirm');
  const [email, setEmail] = useState(userEmail);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);

  const requestOtp = useRequestDeleteAccountOtp();
  const deleteAccount = useDeleteAccount();

  const handleRequestOtp = async () => {
    setError(null);
    try {
      await requestOtp.mutateAsync(email);
      setStep('otp');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to send OTP'));
    }
  };

  const handleDelete = async () => {
    setError(null);
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }
    try {
      await deleteAccount.mutateAsync({ email, otp: code });
      onClose();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to delete account'));
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
  };

  if (step === 'confirm') {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4">
        <div className="w-full max-w-md rounded-2xl bg-dashboard-card p-5 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-dashboard-heading">Delete account</h2>
            <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-dashboard-border/50" aria-label="Close">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <p className="text-sm text-dashboard-body mb-6">
            By deleting account, you will lose access to properties, finances and more attached to this account. Are you sure you want to delete your account?
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setStep('email')}
              className="w-full rounded-xl bg-red-500/90 py-3 text-sm font-medium text-white hover:bg-red-600"
            >
              Yes, delete
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-cohold-blue py-3 text-sm font-medium text-white hover:opacity-90"
            >
              No, cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'email') {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4">
        <div className="w-full max-w-md rounded-2xl bg-dashboard-card p-5 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-dashboard-heading">Confirm account deletion</h2>
            <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-dashboard-border/50" aria-label="Close">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <p className="text-sm text-dashboard-body mb-4">
            To complete account deletion, please enter your email in the field below.
          </p>
          <div className="mb-4">
            <label className="text-sm font-medium text-dashboard-heading block mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="joedoe@mail.com"
              className="w-full rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-dashboard-heading placeholder:text-dashboard-muted"
            />
          </div>
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleRequestOtp}
              disabled={requestOtp.isPending}
              className="w-full rounded-xl bg-red-500/90 py-3 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              {requestOtp.isPending ? 'Sending...' : 'Delete account'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-cohold-blue py-3 text-sm font-medium text-white hover:opacity-90"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-2xl bg-dashboard-card p-5 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-dashboard-heading">OTP Code</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-dashboard-border/50" aria-label="Close">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <p className="text-sm text-dashboard-body mb-4">
          A 6-digit OTP has been sent to your email. Enter the code to confirm account deletion.
        </p>
        <div className="flex justify-center gap-2 mb-6">
          {otp.map((digit, i) => (
            <input
              key={i}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              className="h-12 w-12 rounded-xl border-2 border-dashboard-border text-center text-lg font-semibold focus:border-cohold-blue focus:outline-none"
            />
          ))}
        </div>
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteAccount.isPending || otp.join('').length !== 6}
          className="w-full rounded-xl bg-red-500/90 py-3 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
        >
          {deleteAccount.isPending ? 'Deleting...' : 'Delete account'}
        </button>
      </div>
    </div>
  );
}
