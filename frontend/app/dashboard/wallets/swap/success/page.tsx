'use client';

import { useRouter } from 'next/navigation';

export default function SwapSuccessPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 space-y-6">
      <div className="h-24 w-24 rounded-2xl bg-blue-500 flex items-center justify-center">
        <svg className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold">Swap Successful</h1>
        <p className="text-sm text-slate-400">
          You have successfully swapped NGN10,000,000 for $1,000.00
        </p>
      </div>

      <button
        onClick={() => router.push('/dashboard/home')}
        className="w-full max-w-md rounded-lg bg-blue-500 text-white py-3 font-medium"
      >
        Back to Home
      </button>
    </div>
  );
}
