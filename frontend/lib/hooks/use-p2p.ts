'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthReady } from '@/lib/hooks/use-auth-ready';
import { useP2PStore, type P2PCurrency, type P2PPreview, type P2PReceipt } from '@/stores/p2p.store';

export type P2PSearchItem = {
  id: string;
  username: string;
  displayName: string | null;
};

export function normalizeHandleInput(input: string) {
  return input.trim().replace(/^@+/, '').toLowerCase();
}

export function useP2PSearchRecipients(query: string) {
  const authReady = useAuthReady();
  const q = normalizeHandleInput(query);

  return useQuery({
    queryKey: ['p2p', 'search', q] as const,
    enabled: authReady && q.length >= 2,
    queryFn: async () => {
      const res = await apiClient.get<{ items: P2PSearchItem[] }>(
        `/transfers/p2p/search?query=${encodeURIComponent(q)}`,
      );
      if (!res.success) throw new Error(res.error ?? 'Failed to search recipients');
      return res.data;
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
}

export function useP2PPreview() {
  const setPreview = useP2PStore((s) => s.setPreview);
  const recipient = useP2PStore((s) => s.recipient);
  const currency = useP2PStore((s) => s.currency);
  const amount = useP2PStore((s) => s.amount);

  return useMutation({
    mutationFn: async () => {
      if (!recipient) throw new Error('Select a recipient');
      const res = await apiClient.post<P2PPreview>('/transfers/p2p/preview', {
        recipientUserId: recipient.id,
        currency,
        amount,
      });
      if (!res.success) throw new Error(res.error ?? 'Failed to preview transfer');
      return res.data;
    },
    onSuccess: (preview) => {
      setPreview(preview);
    },
  });
}

export function useP2PExecute() {
  const setLastReceipt = useP2PStore((s) => s.setLastReceipt);
  const recipient = useP2PStore((s) => s.recipient);
  const currency = useP2PStore((s) => s.currency);
  const amount = useP2PStore((s) => s.amount);
  const note = useP2PStore((s) => s.note);

  return useMutation({
    mutationFn: async (idempotencyKey: string) => {
      if (!recipient) throw new Error('Select a recipient');
      const res = await apiClient.post<P2PReceipt>('/transfers/p2p/execute', {
        recipientUserId: recipient.id,
        currency: currency as P2PCurrency,
        amount,
        note: note.trim() ? note.trim() : undefined,
        idempotencyKey,
      });
      if (!res.success) throw new Error(res.error ?? 'Failed to send transfer');
      return res.data;
    },
    onSuccess: (receipt) => {
      setLastReceipt(receipt);
    },
  });
}

