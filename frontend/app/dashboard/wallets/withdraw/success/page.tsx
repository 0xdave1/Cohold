'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { formatMoney } from '@/lib/hooks/use-wallet';

export default function WithdrawSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const amount = searchParams.get('amount') ?? '100000';
  const accountNumber = searchParams.get('account') ?? '0123456890';
  const accountName = searchParams.get('name') ?? 'Joe Doe';
  const bankName = searchParams.get('bank') ?? 'Summit Bank';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 space-y-6">
      <div className="h-24 w-24 rounded-2xl bg-blue-500 flex items-center justify-center">
        <svg className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold">Withdrawal is successful 🎉</h1>
        <p className="text-sm text-slate-400">
          You have successfully withdrawn {formatMoney(amount, 'NGN')}
        </p>
      </div>

      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
        <h2 className="text-sm font-semibold mb-3">Recipient details</h2>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Account number</span>
          <span className="font-mono">{accountNumber}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Account name</span>
          <span>{accountName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Bank name</span>
          <span>{bankName}</span>
        </div>
      </div>

      <div className="w-full max-w-md space-y-3">
        <button className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 font-medium">
          View receipt
        </button>
        <button
          onClick={() => router.push('/dashboard/home')}
          className="w-full rounded-lg bg-blue-500 text-white px-4 py-3 font-medium"
        >
          Go back Home
        </button>
      </div>
    </div>
  );
}
