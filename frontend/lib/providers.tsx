'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthBootstrap } from '@/lib/auth-bootstrap';
import { axiosQueryRetryPredicate } from '@/lib/api/security-errors';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /** Fintech: balances & positions must not stay stale after navigation. */
            staleTime: 0,
            refetchOnMount: true,
            refetchOnWindowFocus: false,
            /** Do not hammer the API after auth, CSRF, rate-limit, or validation failures (Issue 9). */
            retry: (failureCount, error) => axiosQueryRetryPredicate(failureCount, error),
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>{children}</AuthBootstrap>
    </QueryClientProvider>
  );
}
