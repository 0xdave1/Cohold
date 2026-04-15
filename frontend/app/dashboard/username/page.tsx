'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useSetUsername, useUsernameAvailability } from '@/lib/hooks/use-username';

function reasonToMessage(reason: string | null | undefined) {
  switch (reason) {
    case 'USERNAME_INVALID':
      return 'Use 3–20 characters: letters, numbers, underscore.';
    case 'USERNAME_RESERVED':
      return 'That username is reserved.';
    case 'USERNAME_TAKEN':
      return 'That username is taken.';
    case 'USERNAME_REQUIRED':
      return 'Username is required.';
    default:
      return null;
  }
}

export default function UsernameSetupPage() {
  const router = useRouter();
  const me = useAuthStore((s) => s.user);

  const [input, setInput] = useState('');
  const setUsername = useSetUsername();

  const availability = useUsernameAvailability(input);
  const normalized = availability.data?.normalizedUsername ?? input.trim().replace(/^@+/, '').toLowerCase();

  const canSubmit = useMemo(() => {
    if (!availability.data) return false;
    return availability.data.available === true;
  }, [availability.data]);

  useEffect(() => {
    if (me?.username) {
      router.replace('/dashboard/home');
    }
  }, [me?.username, router]);

  return (
    <div className="min-h-screen bg-dashboard-bg px-4 pt-6 pb-24">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-dashboard-heading">Choose a username</h1>
          <p className="text-sm text-dashboard-body">
            Your username is how people find you for P2P transfers. You can set it once.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-dashboard-body">Username</label>
          <div className="flex items-center rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2">
            <span className="text-dashboard-body/60">@</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="yourname"
              className="ml-1 w-full bg-transparent text-dashboard-heading outline-none placeholder:text-dashboard-body/40"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          {availability.isFetching ? (
            <p className="text-xs text-dashboard-body/70">Checking availability…</p>
          ) : availability.data ? (
            availability.data.available ? (
              <p className="text-xs text-emerald-600">Available: @{availability.data.normalizedUsername}</p>
            ) : (
              <p className="text-xs text-amber-700">{reasonToMessage(availability.data.reason)}</p>
            )
          ) : null}
        </div>

        {setUsername.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {setUsername.error instanceof Error ? setUsername.error.message : 'Failed to set username'}
          </div>
        ) : null}

        <button
          type="button"
          disabled={!canSubmit || setUsername.isPending}
          onClick={async () => {
            await setUsername.mutateAsync(normalized);
            router.replace('/dashboard/home');
          }}
          className="w-full rounded-xl bg-cohold-blue py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {setUsername.isPending ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </span>
          ) : (
            'Continue'
          )}
        </button>
      </div>
    </div>
  );
}

