'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useP2PTransfer } from '@/lib/hooks/use-mutations';
import { useAuth } from '@/lib/hooks/use-auth';
import Decimal from 'decimal.js';

export default function P2PPage() {
  const router = useRouter();
  const [step, setStep] = useState<'username' | 'amount' | 'summary'>('username');
  const [username, setUsername] = useState('');
  const [amount, setAmount] = useState('100000');
  const [selectedCurrency, setSelectedCurrency] = useState<'NGN' | 'USD' | 'GBP' | 'EUR'>('NGN');
  const [showOtp, setShowOtp] = useState(false);
  
  const p2pMutation = useP2PTransfer();
  const { requestOtp } = useAuth();

  // Mock recipient data - in production, fetch from backend
  const recipient = username ? { name: 'Adetomi', avatar: 'A' } : null;

  const handleSend = async () => {
    if (step === 'username') {
      if (username) {
        setStep('amount');
      }
      return;
    }

    if (step === 'amount') {
      // Check if OTP required (high-value threshold)
      const amountDecimal = new Decimal(amount);
      if (amountDecimal.gt(1000000)) {
        // Request OTP for high-value transfer
        await requestOtp.mutateAsync({
          email: 'user@example.com', // Get from auth store
          purpose: 'transaction',
        });
        setShowOtp(true);
        return;
      }
      setStep('summary');
      return;
    }

    // Final step: execute transfer
    await p2pMutation.mutateAsync({
      recipientHandle: username.startsWith('@') ? username : `@${username}`,
      amount,
      clientReference: `P2P-${Date.now()}`,
    });

    router.push('/dashboard/wallets/p2p/success');
  };

  if (showOtp) {
    return (
      <OtpModal
        onComplete={() => {
          setShowOtp(false);
          setStep('summary');
        }}
        onClose={() => setShowOtp(false)}
      />
    );
  }

  if (step === 'username') {
    return (
      <div className="space-y-6 pb-20">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold">P2P</h1>
        </div>

        <p className="text-sm text-slate-400">
          Send funds to friends and colleagues. Search for the username to send funds.
        </p>

        <div>
          <label className="text-sm text-slate-400 mb-2 block">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@username"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
          />
        </div>

        {/* Recent contacts - mock data */}
        {username && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
            <p className="text-xs text-slate-400 mb-2">Recent contacts</p>
            {[
              { name: 'Adetomi', username: '@adetomi', avatar: 'A' },
              { name: 'John', username: '@john', avatar: 'J' },
            ].map((contact) => (
              <button
                key={contact.username}
                onClick={() => {
                  setUsername(contact.username);
                  setStep('amount');
                }}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800"
              >
                <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-medium">
                  {contact.avatar}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{contact.name}</p>
                  <p className="text-xs text-slate-400">{contact.username}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={!username}
          className="w-full rounded-lg bg-blue-500 text-white py-3 font-medium disabled:opacity-50"
        >
          Enter amount
        </button>
      </div>
    );
  }

  if (step === 'amount') {
    return (
      <div className="space-y-6 pb-20">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('username')}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold">P2P</h1>
        </div>

        {recipient && (
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/40">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-medium">
                {recipient.avatar}
              </div>
              <span className="font-medium">{recipient.name}</span>
            </div>
            <button
              onClick={() => setStep('username')}
              className="text-sm text-blue-400"
            >
              Change
            </button>
          </div>
        )}

        <div>
          <label className="text-sm text-slate-400 mb-2 block">Amount to send</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, '');
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  setAmount(val);
                }
              }}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
              placeholder="0.00"
            />
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value as any)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="NGN">NGN</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Equals {selectedCurrency} {new Intl.NumberFormat('en-NG').format(parseFloat(amount) || 0)}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setStep('username')}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 font-medium"
          >
            Go back
          </button>
          <button
            onClick={handleSend}
            disabled={!amount || new Decimal(amount).lte(0)}
            className="flex-1 rounded-lg bg-blue-500 text-white px-4 py-3 font-medium disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    );
  }

  // Summary step
  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <button onClick={() => setStep('amount')}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">P2P summary</h1>
      </div>

      {recipient && (
        <div className="flex items-center justify-center gap-3 p-4">
          <div className="h-12 w-12 rounded-full bg-orange-500 flex items-center justify-center text-white font-medium text-lg">
            {recipient.avatar}
          </div>
          <span className="font-medium text-lg">{recipient.name}</span>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div className="flex justify-between">
          <span className="text-slate-400">Amount sent</span>
          <span className="font-medium">
            {new Intl.NumberFormat('en-NG', {
              style: 'currency',
              currency: selectedCurrency,
            }).format(parseFloat(amount) || 0)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Amount received</span>
          <span className="font-medium">
            {new Intl.NumberFormat('en-NG', {
              style: 'currency',
              currency: selectedCurrency,
            }).format(parseFloat(amount) || 0)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Processing fee</span>
          <span className="font-medium">NGN 100.00</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setStep('amount')}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 font-medium"
        >
          Go back
        </button>
        <button
          onClick={handleSend}
          disabled={p2pMutation.isPending}
          className="flex-1 rounded-lg bg-blue-500 text-white px-4 py-3 font-medium disabled:opacity-50"
        >
          {p2pMutation.isPending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

function OtpModal({
  onComplete,
  onClose,
}: {
  onComplete: () => void;
  onClose: () => void;
}) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useState<(HTMLInputElement | null)[]>([])[0];

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      inputRefs[index + 1]?.focus();
    }
  };

  const handleSubmit = () => {
    if (otp.join('').length === 6) {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="bg-slate-900 rounded-t-2xl w-full max-h-[80vh] p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">OTP Code</h2>
          <button onClick={onClose} className="p-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            A 6-digit OTP has been sent to your email, enter code to confirm transaction.
          </p>
          <div className="flex items-center justify-center gap-2">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                className="h-12 w-12 rounded-lg border-2 border-slate-700 text-center text-lg font-semibold focus:border-blue-500 focus:outline-none bg-slate-800"
              />
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={otp.join('').length !== 6}
            className="w-full rounded-lg bg-blue-500 text-white py-3 font-medium disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
