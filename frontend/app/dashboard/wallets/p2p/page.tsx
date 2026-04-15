'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useP2PSearchRecipients, normalizeHandleInput } from '@/lib/hooks/use-p2p';
import { useP2PStore } from '@/stores/p2p.store';

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
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} aria-label="Back">
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
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setRecipient(null);
          }}
          placeholder="@username"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
        <p className="text-xs text-slate-400 mb-2">Results</p>

        {search.isFetching ? (
          <p className="text-sm text-slate-400">Searching…</p>
        ) : search.isError ? (
          <p className="text-sm text-slate-400">
            Could not search. Try again.
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-400">
            {normalizeHandleInput(query).length < 2 ? 'Type at least 2 characters.' : 'No users found.'}
          </p>
        ) : (
          items.map((u) => {
            const active = selected?.id === u.id;
            const avatar = (u.displayName?.[0] ?? u.username?.[0] ?? 'U').toUpperCase();
            return (
              <button
                key={u.id}
                onClick={() => setRecipient(u)}
                className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 ${
                  active ? 'bg-slate-800' : ''
                }`}
              >
                <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-medium">
                  {avatar}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{u.displayName ?? `@${u.username}`}</p>
                  <p className="text-xs text-slate-400">@{u.username}</p>
                </div>
                <span className="text-slate-400">{active ? '✓' : ''}</span>
              </button>
            );
          })
        )}
      </div>

      <button
        onClick={() => router.push('/dashboard/wallets/p2p/amount')}
        disabled={!canContinue}
        className="w-full rounded-lg bg-blue-500 text-white py-3 font-medium disabled:opacity-50"
      >
        Enter amount
      </button>
    </div>
  );
}
