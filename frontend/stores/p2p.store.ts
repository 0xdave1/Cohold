import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type P2PCurrency = 'NGN';

export type P2PRecipient = {
  id: string;
  username: string;
  displayName: string | null;
};

export type P2PPreview = {
  currency: P2PCurrency;
  amount: string;
  fee: string;
  recipientAmount: string;
  senderBalance: string;
  recipient: P2PRecipient;
};

export type P2PReceipt = {
  id: string;
  groupId: string;
  currency: P2PCurrency;
  amount: string;
  fee: string;
  recipientAmount: string;
  note: string | null;
  recipient?: P2PRecipient;
  createdAt: string;
};

type P2PState = {
  recipient: P2PRecipient | null;
  currency: P2PCurrency;
  amount: string;
  note: string;
  preview: P2PPreview | null;
  lastReceipt: P2PReceipt | null;
  setRecipient: (r: P2PRecipient | null) => void;
  setCurrency: (c: P2PCurrency) => void;
  setAmount: (a: string) => void;
  setNote: (n: string) => void;
  setPreview: (p: P2PPreview | null) => void;
  setLastReceipt: (r: P2PReceipt | null) => void;
  resetFlow: () => void;
};

const INITIAL: Pick<P2PState, 'recipient' | 'currency' | 'amount' | 'note' | 'preview' | 'lastReceipt'> =
  {
    recipient: null,
    currency: 'NGN',
    amount: '',
    note: '',
    preview: null,
    lastReceipt: null,
  };

export const useP2PStore = create<P2PState>()(
  persist(
    (set) => ({
      ...INITIAL,
      setRecipient: (recipient) => set({ recipient, preview: null }),
      setCurrency: () => set({ currency: 'NGN', preview: null }),
      setAmount: (amount) => set({ amount, preview: null }),
      setNote: (note) => set({ note }),
      setPreview: (preview) => set({ preview }),
      setLastReceipt: (lastReceipt) => set({ lastReceipt }),
      resetFlow: () => set({ ...INITIAL }),
    }),
    {
      name: 'cohold-p2p',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        recipient: s.recipient,
        currency: s.currency,
        amount: s.amount,
        note: s.note,
        preview: s.preview,
        lastReceipt: s.lastReceipt,
      }),
    },
  ),
);

