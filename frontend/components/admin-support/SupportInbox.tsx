'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/lib/admin/api';
import type { AdminSupportConversation, AdminSupportMessage } from '@/lib/admin/support-types';
import { SupportPresenceToggle } from './SupportPresenceToggle';
import {
  buildSupportConversationsQueryString,
  CATEGORY_LABEL,
  SUPPORT_TABS,
  type AdminSupportConversationsQuery,
} from './support-constants';
// Admin Socket.IO auth uses JWT in handshake. Today the admin JWT is httpOnly and not accessible in JS,
// so the inbox uses REST for realtime-sensitive updates. (User side support uses WS via access token in Zustand.)

function formatDt(value: string | null | undefined): string {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-US', { month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit' });
}

export function SupportInbox() {
  const [tabKey, setTabKey] = useState(SUPPORT_TABS[0]?.key ?? 'unassigned');
  const tab = SUPPORT_TABS.find((t) => t.key === tabKey) ?? SUPPORT_TABS[0]!;
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminSupportConversation[]>([]);
  const [active, setActive] = useState<AdminSupportConversation | null>(null);
  const [messages, setMessages] = useState<AdminSupportMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [working, setWorking] = useState(false);
  const [online, setOnline] = useState(false);
  const [presenceWorking, setPresenceWorking] = useState(false);
  // reserved for future: admin WS connection once token is available client-side
  const [socket, setSocket] = useState<null>(null);

  const query = useMemo<AdminSupportConversationsQuery>(
    () => ({
      page: 1,
      limit: 50,
      search: search.trim() || undefined,
      status: tab.filter.status,
      category: tab.filter.disputes ? 'DISPUTE' : undefined,
      assigned: tab.filter.assigned,
    }),
    [search, tab.filter.status, tab.filter.disputes, tab.filter.assigned],
  );

  const queryString = useMemo(() => buildSupportConversationsQueryString(query), [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi
      .supportConversations(queryString)
      .then((d: { items?: AdminSupportConversation[] }) => {
        if (cancelled) return;
        setItems(d.items ?? []);
        if (active) {
          const still = (d.items ?? []).find((x) => x.id === active.id) ?? null;
          setActive(still);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setItems([]);
        setError(e instanceof Error ? e.message : 'Failed to load support inbox');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  useEffect(() => {
    // Lightweight polling fallback (admin WS token is httpOnly).
    const t = window.setInterval(() => {
      adminApi
        .supportConversations(queryString)
        .then((d: { items?: AdminSupportConversation[] }) => {
          setItems(d.items ?? []);
          if (active) {
            const still = (d.items ?? []).find((x) => x.id === active.id) ?? null;
            setActive(still);
          }
        })
        .catch(() => {
          // keep last good data; primary fetch path handles visible errors
        });
      if (active?.id) {
        adminApi
          .supportMessages(active.id, 'page=1&limit=200')
          .then((d: { items?: AdminSupportMessage[] }) => setMessages(d.items ?? []))
          .catch(() => {
            // ignore intermittent refresh failures
          });
      }
    }, 5000);
    return () => window.clearInterval(t);
  }, [queryString, active?.id]);

  useEffect(() => {
    // load current presence from online list (if this admin is included)
    adminApi
      .onlineSupportAgents()
      .then((rows: any[]) => {
        // We don't have adminId client-side here; default to offline and let toggle set it.
        // Presence is persisted server-side.
        setOnline(Array.isArray(rows) && rows.length > 0);
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  useEffect(() => {
    // WS: connect using admin access token cookie is not available in JS.
    // Admin WS auth uses JWT in handshake; we rely on REST for now.
    void socket;
    void setSocket;
  }, []);

  const loadMessages = async (conversationId: string) => {
    setMsgLoading(true);
    setMsgError(null);
    try {
      const d = await adminApi.supportMessages(conversationId, 'page=1&limit=200');
      setMessages(d.items ?? []);
    } catch (e: unknown) {
      setMessages([]);
      setMsgError(e instanceof Error ? e.message : 'Failed to load messages');
    } finally {
      setMsgLoading(false);
    }
  };

  const openConversation = async (c: AdminSupportConversation) => {
    setActive(c);
    await loadMessages(c.id);
  };

  const setPresence = async (next: boolean) => {
    setPresenceWorking(true);
    try {
      await adminApi.setSupportPresence({ isOnline: next });
      setOnline(next);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not update support presence');
    } finally {
      setPresenceWorking(false);
    }
  };

  const assignToMe = async () => {
    if (!active) return;
    setWorking(true);
    try {
      await adminApi.assignSupportConversation(active.id, {});
      await adminApi.supportConversation(active.id).then((d: AdminSupportConversation) => setActive(d));
      await adminApi.supportConversations(queryString).then((d: any) => setItems(d.items ?? []));
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not assign conversation');
    } finally {
      setWorking(false);
    }
  };

  const resolve = async () => {
    if (!active) return;
    setWorking(true);
    try {
      await adminApi.resolveSupportConversation(active.id);
      await adminApi.supportConversation(active.id).then((d: AdminSupportConversation) => setActive(d));
      await adminApi.supportConversations(queryString).then((d: any) => setItems(d.items ?? []));
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not resolve conversation');
    } finally {
      setWorking(false);
    }
  };

  const sendReply = async () => {
    if (!active || !reply.trim()) return;
    setWorking(true);
    try {
      await adminApi.sendSupportMessage(active.id, { content: reply.trim() });
      setReply('');
      await loadMessages(active.id);
      await adminApi.supportConversations(queryString).then((d: any) => setItems(d.items ?? []));
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not send reply');
    } finally {
      setWorking(false);
    }
  };

  const addNote = async () => {
    if (!active || !note.trim()) return;
    setWorking(true);
    try {
      await adminApi.addSupportInternalNote(active.id, { content: note.trim() });
      setNote('');
      await loadMessages(active.id);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save note');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Support</h1>
          <p className="text-sm text-gray-500">Live chats, offline tickets, and disputes.</p>
        </div>
        <SupportPresenceToggle isOnline={online} loading={presenceWorking} onToggle={setPresence} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {SUPPORT_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTabKey(t.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              tabKey === t.key ? 'bg-[#1a3a4a] text-white' : 'bg-white border border-gray-200 text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto w-full sm:w-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference, subject, email…"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-[#F8F8F8] px-4 py-3">
              <p className="text-sm font-semibold text-gray-900">Conversations</p>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              {loading ? (
                <div className="p-4">
                  <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
                </div>
              ) : error ? (
                <div className="p-4 text-sm text-red-700">{error}</div>
              ) : items.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">No conversations.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {items.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => openConversation(c)}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 ${
                        active?.id === c.id ? 'bg-gray-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">{c.referenceCode}</p>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                          {c.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {c.user.email} · {CATEGORY_LABEL[c.category]}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">Last: {formatDt(c.lastMessageAt)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-white px-4 py-3">
              {active ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {active.referenceCode} · {CATEGORY_LABEL[active.category]}
                    </p>
                    <p className="text-xs text-gray-500">{active.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={assignToMe}
                      disabled={working}
                      className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
                    >
                      Assign to me
                    </button>
                    <button
                      type="button"
                      onClick={resolve}
                      disabled={working}
                      className="rounded-full bg-[#1a3a4a] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Select a conversation to view.</p>
              )}
            </div>

            <div className="max-h-[55vh] overflow-auto p-4">
              {!active ? null : msgLoading ? (
                <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
              ) : msgError ? (
                <div className="text-sm text-red-700">{msgError}</div>
              ) : (
                <div className="space-y-2">
                  {messages
                    .filter((m) => m.messageType !== 'INTERNAL_NOTE')
                    .map((m) => (
                      <div key={m.id} className={m.senderType === 'ADMIN' ? 'flex justify-end' : 'flex justify-start'}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                            m.senderType === 'ADMIN' ? 'bg-[#1a3a4a] text-white' : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.content}</p>
                          <p className="mt-1 text-[11px] opacity-80">{formatDt(m.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {active ? (
              <div className="border-t border-gray-200 p-4">
                <div className="grid grid-cols-1 gap-3">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Reply to user…"
                    className="min-h-[90px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={sendReply}
                      disabled={working || !reply.trim()}
                      className="rounded-full bg-[#00416A] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-[#F8F8F8] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Internal note</p>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add internal note (not visible to user)…"
                      className="mt-2 min-h-[70px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={addNote}
                        disabled={working || !note.trim()}
                        className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Save note
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

