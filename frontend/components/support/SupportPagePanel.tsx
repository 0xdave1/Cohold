'use client';

import { useMemo, useState } from 'react';
import type { SupportCategory, SupportConversation } from '@/lib/support/types';
import {
  useCreateSupportConversation,
  usePresignSupportAttachment,
  useSendSupportMessage,
  useSupportConversations,
  useSupportMessages,
} from '@/lib/hooks/use-support';
import { useSupportSocket } from '@/lib/hooks/use-support-socket';

const CATEGORIES: Array<{ value: SupportCategory; label: string; description: string }> = [
  { value: 'PAYMENT_ISSUE', label: 'Payment issue', description: 'Card charge, duplicates, failed payments.' },
  { value: 'WITHDRAWAL_ISSUE', label: 'Withdrawal issue', description: 'Pending or failed withdrawals.' },
  { value: 'INVESTMENT_ISSUE', label: 'Investment issue', description: 'Buys, sells, ROI, portfolio.' },
  { value: 'WALLET_ISSUE', label: 'Wallet issue', description: 'Balance, transfers, swaps.' },
  { value: 'KYC_ISSUE', label: 'KYC issue', description: 'Verification, document upload.' },
  { value: 'PROPERTY_ISSUE', label: 'Property issue', description: 'Listing questions and access.' },
  { value: 'GENERAL_SUPPORT', label: 'General support', description: 'Anything else.' },
  { value: 'DISPUTE', label: 'Dispute', description: 'Raise a dispute with structured details.' },
];

function categorySubject(category: SupportCategory): string {
  const item = CATEGORIES.find((c) => c.value === category);
  return item ? item.label : 'Support request';
}

export function SupportPagePanel() {
  const [mode, setMode] = useState<'list' | 'triage' | 'thread'>('list');
  const [activeConversation, setActiveConversation] = useState<SupportConversation | null>(null);
  const [category, setCategory] = useState<SupportCategory>('GENERAL_SUPPORT');
  const [message, setMessage] = useState('');
  const [txRef, setTxRef] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [propertyId, setPropertyId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const { data: conversations, isLoading, isError, error: loadErr } = useSupportConversations();
  const createConversation = useCreateSupportConversation();
  const sendMessage = useSendSupportMessage();
  const presign = usePresignSupportAttachment();

  const conversationId = activeConversation?.id ?? null;
  useSupportSocket(mode === 'thread' ? conversationId : null);

  const { data: messagesData } = useSupportMessages(mode === 'thread' ? conversationId : null, 1, 100);
  const messages = messagesData?.items ?? [];

  const title = useMemo(() => {
    if (mode === 'triage') return 'Support';
    if (mode === 'thread') return activeConversation?.referenceCode ?? 'Support';
    return 'Support';
  }, [mode, activeConversation?.referenceCode]);

  const startNew = () => {
    setError(null);
    setCategory('GENERAL_SUPPORT');
    setMessage('');
    setTxRef('');
    setAmount('');
    setCurrency('NGN');
    setPropertyId('');
    setFile(null);
    setMode('triage');
  };

  const openThread = (c: SupportConversation) => {
    setActiveConversation(c);
    setMode('thread');
    setError(null);
  };

  const submitTriage = async () => {
    setError(null);
    try {
      const conv = await createConversation.mutateAsync({
        category,
        subject: categorySubject(category),
        metadata:
          category === 'DISPUTE' || category.endsWith('_ISSUE')
            ? {
                transactionReference: txRef || undefined,
                amount: amount || undefined,
                currency: currency || undefined,
                propertyId: propertyId || undefined,
              }
            : undefined,
      });

      const msgId = crypto.randomUUID();
      let attachments:
        | Array<{ storageKey: string; mimeType: string; sizeBytes: number; fileName?: string }>
        | undefined;
      if (file) {
        const { storageKey, uploadUrl } = await presign.mutateAsync({
          conversationId: conv.id,
          messageId: msgId,
          mimeType: file.type || 'application/octet-stream',
          fileName: file.name,
        });
        await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        attachments = [
          { storageKey, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size, fileName: file.name },
        ];
      }

      if (message.trim()) {
        await sendMessage.mutateAsync({
          conversationId: conv.id,
          messageId: msgId,
          content: message.trim(),
          attachments,
          metadata: {
            transactionReference: txRef || undefined,
            amount: amount || undefined,
            currency: currency || undefined,
            propertyId: propertyId || undefined,
          },
        });
      }

      setActiveConversation(conv);
      setMode('thread');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not start support chat');
    }
  };

  const send = async () => {
    if (!conversationId) return;
    if (!message.trim()) return;
    setError(null);
    try {
      await sendMessage.mutateAsync({
        conversationId,
        content: message.trim(),
      });
      setMessage('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send message');
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-dashboard-border bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between border-b border-dashboard-border bg-dashboard-card px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-dashboard-heading">{title}</p>
          <p className="text-[11px] text-dashboard-body">Cohold customer support</p>
        </div>
        <div className="flex items-center gap-2">
          {mode !== 'list' ? (
            <button
              type="button"
              onClick={() => {
                setMode('list');
                setActiveConversation(null);
              }}
              className="rounded-lg px-2 py-1 text-xs font-medium text-dashboard-heading hover:bg-dashboard-border/40"
            >
              Back
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {mode === 'list' ? (
        <div className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-dashboard-heading">Your conversations</p>
            <button
              type="button"
              onClick={startNew}
              className="rounded-full bg-cohold-blue px-3 py-1.5 text-xs font-semibold text-white"
            >
              New
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {isLoading ? (
              <div className="h-20 animate-pulse rounded-xl bg-dashboard-border/60" />
            ) : isError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {loadErr instanceof Error ? loadErr.message : 'Failed to load conversations'}
              </div>
            ) : conversations && conversations.length > 0 ? (
              conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openThread(c)}
                  className="w-full rounded-xl border border-dashboard-border bg-white px-3 py-3 text-left hover:bg-dashboard-bg"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-dashboard-heading">{c.referenceCode}</p>
                    <span className="rounded-full bg-dashboard-border/50 px-2 py-0.5 text-[10px] font-medium text-dashboard-body">
                      {c.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-dashboard-body">{c.subject ?? c.category.replace(/_/g, ' ')}</p>
                </button>
              ))
            ) : (
              <div className="rounded-xl border border-dashboard-border bg-dashboard-card p-4 text-xs text-dashboard-body">
                No conversations yet. Start a new support chat.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {mode === 'triage' ? (
        <div className="max-h-[min(70vh,640px)] overflow-auto p-4">
          <p className="text-sm font-semibold text-dashboard-heading">What can we help you with?</p>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`rounded-xl border px-3 py-3 text-left ${
                  category === c.value ? 'border-cohold-blue bg-[#EAF3FA]' : 'border-dashboard-border bg-white'
                }`}
              >
                <p className="text-sm font-semibold text-dashboard-heading">{c.label}</p>
                <p className="text-xs text-dashboard-body">{c.description}</p>
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-dashboard-heading">Details (optional)</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={txRef}
                onChange={(e) => setTxRef(e.target.value)}
                placeholder="Transaction ref"
                className="w-full rounded-xl border border-dashboard-border px-3 py-2 text-xs"
              />
              <input
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                placeholder="Property ID"
                className="w-full rounded-xl border border-dashboard-border px-3 py-2 text-xs"
              />
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount"
                className="w-full rounded-xl border border-dashboard-border px-3 py-2 text-xs"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-xl border border-dashboard-border px-3 py-2 text-xs"
              >
                <option value="NGN">NGN</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message…"
              className="min-h-[90px] w-full rounded-xl border border-dashboard-border px-3 py-2 text-xs"
            />

            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs text-dashboard-body"
            />
          </div>

          <button
            type="button"
            onClick={submitTriage}
            disabled={createConversation.isPending || sendMessage.isPending || presign.isPending}
            className="mt-4 w-full rounded-full bg-cohold-blue py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {createConversation.isPending ? 'Starting…' : 'Start chat'}
          </button>
        </div>
      ) : null}

      {mode === 'thread' ? (
        <div className="flex max-h-[min(70vh,640px)] flex-col">
          <div className="flex-1 space-y-2 overflow-auto p-4 min-h-[200px]">
            {messages.length === 0 ? (
              <div className="text-xs text-dashboard-body">No messages yet.</div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={m.senderType === 'USER' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs ${
                      m.senderType === 'USER'
                        ? 'bg-cohold-blue text-white'
                        : m.senderType === 'BOT'
                          ? 'bg-dashboard-border/60 text-dashboard-heading'
                          : 'bg-dashboard-card text-dashboard-heading'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.attachments && m.attachments.length > 0 ? (
                      <p className="mt-1 text-[10px] opacity-90">Attachment saved ({m.attachments.length})</p>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-dashboard-border p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message…"
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-dashboard-border px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={send}
                disabled={sendMessage.isPending || !message.trim()}
                className="h-11 rounded-full bg-cohold-blue px-4 text-xs font-semibold text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
            <p className="mt-2 text-[10px] text-dashboard-body">
              Support bot can triage only. A human agent will respond when available.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
