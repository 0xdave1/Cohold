'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useP2PSearchRecipients, normalizeHandleInput } from '@/lib/hooks/use-p2p';
import { useP2PStore } from '@/stores/p2p.store';
import { Search } from 'lucide-react';

export default function P2PPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  const setRecipient = useP2PStore((s) => s.setRecipient);
  const resetFlow = useP2PStore((s) => s.resetFlow);
  const selected = useP2PStore((s) => s.recipient);

  useEffect(() => {
    resetFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const search = useP2PSearchRecipients(debounced);
  const items = search.data?.items ?? [];

  const canContinue = useMemo(() => !!selected, [selected]);

  return (
    <div className="space-y-6 pb-28 max-w-sm mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} aria-label="Back">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-dashboard-heading">P2P</h1>
      </div>

      <p className="text-xs text-dashboard-body">
        Send funds to friends and colleagues. Search for the username to send funds.
      </p>

      <div>
        <label className="text-xs font-medium text-dashboard-body mb-2 block">Username</label>
        <div className="flex items-center rounded-xl border border-dashboard-border bg-white px-3 py-2.5">
          <Search className="h-4 w-4 text-dashboard-muted" aria-hidden />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setRecipient(null);
            }}
            placeholder="@username"
            className="ml-2 w-full bg-transparent text-dashboard-heading placeholder:text-dashboard-muted outline-none text-sm"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-dashboard-border bg-dashboard-card overflow-hidden">
        {search.isFetching ? (
          <div className="p-4 text-sm text-dashboard-body">Searching…</div>
        ) : search.isError ? (
          <div className="p-4 text-sm text-dashboard-body">Could not search. Try again.</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-dashboard-body">
            {normalizeHandleInput(query).length < 2
              ? 'Type at least 2 characters.'
              : 'No users found.'}
          </div>
        ) : (
          <div className="divide-y divide-dashboard-border">
            {items.map((u) => {
              const active = selected?.id === u.id;
              const avatar = (u.displayName?.[0] ?? u.username?.[0] ?? 'U').toUpperCase();
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setRecipient(u)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 bg-white ${
                    active ? 'ring-1 ring-cohold-blue/30 border-l-0 border-r-0' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-[#F5D99A] flex items-center justify-center text-cohold-blue font-semibold">
                      {avatar}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-dashboard-heading truncate">
                        {u.displayName ?? `@${u.username}`}
                      </p>
                      <p className="text-xs text-dashboard-body truncate">@{u.username}</p>
                    </div>
                  </div>

                  <span
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      active ? 'border-cohold-blue' : 'border-dashboard-border'
                    }`}
                    aria-hidden
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        active ? 'bg-cohold-blue' : 'bg-transparent'
                      }`}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom CTA (sits above the fixed bottom nav) */}
      <div className="fixed bottom-16 left-0 right-0 z-40 pointer-events-none">
        <div className="mx-auto max-w-2xl px-4 pointer-events-auto">
          <button
            type="button"
            onClick={() => router.push('/dashboard/wallets/p2p/amount')}
            disabled={!canContinue}
            className="w-full rounded-xl bg-cohold-blue py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enter amount
          </button>
        </div>
      </div>
    </div>
  );
}
