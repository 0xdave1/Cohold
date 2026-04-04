import type { Metadata } from 'next';
import Link from 'next/link';
import { OfflineRetryButton } from '@/components/pwa/OfflineRetryButton';

export const metadata: Metadata = {
  title: 'Offline',
  description: 'You are offline. Reconnect to use Cohold.',
};

/**
 * Static offline fallback: shown when navigation fails in the service worker.
 * No financial actions; messaging is explicit that money features need the network.
 */
export default function OfflinePage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#F7F4F0] px-6 py-12 text-[#1A1A1A]">
      <div className="max-w-md w-full rounded-2xl border border-black/10 bg-white p-8 shadow-sm text-center space-y-4">
        <h1 className="text-xl font-semibold text-[#00406C]">You&apos;re offline</h1>
        <p className="text-sm text-[#1A1A1A]/80 leading-relaxed">
          We can&apos;t reach Cohold right now. Wallet balances, investments, transfers, and funding
          always require a secure connection — nothing is processed while you&apos;re offline.
        </p>
        <p className="text-xs text-[#1A1A1A]/60">
          When you&apos;re back online, open the app again or tap Retry below.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <OfflineRetryButton />
          <Link
            href="/"
            className="inline-flex justify-center rounded-full border border-[#00406C]/30 px-5 py-2.5 text-sm font-medium text-[#00406C] hover:bg-[#00406C]/5 min-h-[44px] items-center"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
