'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export default function TopUpPage() {
  const { data: virtualAccount } = useQuery({
    queryKey: ['virtual-account'],
    queryFn: async () => {
      const res = await apiClient.get<
        Array<{ accountNumber: string; bankName: string; accountName: string; currency: string }>
      >('/wallets/virtual-accounts');
      if (!res.success || !res.data?.length) return null;
      const ngn = res.data.find((a) => a.currency === 'NGN') ?? res.data[0];
      return ngn;
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Top up</h1>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <p className="text-sm text-slate-400">
          Transfer funds to your virtual account to top up your wallet
        </p>

        {virtualAccount ? (
          <>
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-700 bg-slate-800">
              <span className="text-sm text-slate-400">Account number</span>
              <div className="flex items-center gap-2">
                <span className="font-mono">{virtualAccount.accountNumber}</span>
                <button
                  onClick={() => copyToClipboard(virtualAccount.accountNumber)}
                  className="p-1"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-700 bg-slate-800">
              <span className="text-sm text-slate-400">Bank name</span>
              <div className="flex items-center gap-2">
                <span>{virtualAccount.bankName}</span>
                <button
                  onClick={() => copyToClipboard(virtualAccount.bankName)}
                  className="p-1"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-700 bg-slate-800">
              <span className="text-sm text-slate-400">Account name</span>
              <div className="flex items-center gap-2">
                <span>{virtualAccount.accountName}</span>
                <button
                  onClick={() => copyToClipboard(virtualAccount.accountName)}
                  className="p-1"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                const allDetails = `${virtualAccount.accountNumber}\n${virtualAccount.bankName}\n${virtualAccount.accountName}`;
                copyToClipboard(allDetails);
              }}
              className="w-full rounded-lg bg-blue-500 text-white py-3 font-medium"
            >
              Copy all
            </button>
          </>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <p>Virtual account will be created after KYC verification</p>
          </div>
        )}
      </div>
    </div>
  );
}
