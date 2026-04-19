'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { adminApi } from '@/lib/admin/api';
import type { AdminUserKycVerification, UserDetail, UserTransaction } from '@/lib/admin/types';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MoreHorizontal,
  User as UserIcon,
  X,
} from 'lucide-react';

type Tab = 'personal' | 'banks' | 'coholds' | 'transactions';

/* ── helpers ─────────────────────────────────────────── */

function fmtMoney(v: string | number, cur = 'NGN') {
  const symbols: Record<string, string> = { NGN: '\u20A6', USD: '$', GBP: '\u00A3', EUR: '\u20AC' };
  const n = typeof v === 'string' ? parseFloat(v) || 0 : v;
  return `${symbols[cur] ?? ''}${new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

function txTypeLabel(t: string) {
  const map: Record<string, string> = {
    WALLET_TOP_UP: 'Top up',
    WALLET_WITHDRAWAL: 'Withdrawal',
    WALLET_SWAP: 'Swap',
    P2P_TRANSFER: 'P2P transfer',
    INVESTMENT: 'Investment',
    DISTRIBUTION: 'Dividend',
    FEE: 'Fee',
  };
  return map[t] ?? t;
}

const TX_STATUS: Record<string, { label: string; cls: string }> = {
  COMPLETED: { label: 'Successful', cls: 'text-green-600' },
  PENDING: { label: 'Pending', cls: 'text-amber-500' },
  FAILED: { label: 'Failed', cls: 'text-red-500' },
};

const BANK_COLORS = ['#C53030', '#DD6B20', '#2B6CB0', '#2F855A', '#6B46C1', '#D53F8C'];

/* ── Main Page ───────────────────────────────────────── */

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('personal');

  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    adminApi
      .userDetail(id)
      .then((d: any) => setUser(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleSuspend = async () => {
    if (!id) return;
    setActing(true);
    try {
      await adminApi.suspendUser(id);
      setUser((u) => (u ? { ...u, isFrozen: true } : u));
    } catch {
      /* ignore */
    }
    setActing(false);
    setShowSuspendModal(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/users" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="h-6 w-52 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="h-24 animate-pulse rounded-xl border border-gray-200 bg-white" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-gray-200 bg-white" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Link href="/admin/users" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p className="text-gray-500">User not found.</p>
      </div>
    );
  }

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  const initials =
    (user.firstName?.[0] ?? user.email[0]).toUpperCase() +
    (user.lastName?.[0] ?? '').toUpperCase();

  const TABS: { key: Tab; label: string }[] = [
    { key: 'personal', label: 'Personal info' },
    { key: 'banks', label: 'Linked banks' },
    { key: 'coholds', label: 'Co-holds' },
    { key: 'transactions', label: 'Transactions' },
  ];

  return (
    <>
      <div className="space-y-6">
        {/* Back + Title */}
        <div className="flex items-center gap-3">
          <Link href="/admin/users" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="text-sm text-gray-400">Back</span>
          <h1 className="ml-2 text-lg font-semibold text-gray-900">{name}&apos;s details</h1>
        </div>

        {/* User header card */}
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-5">
          <div className="flex items-center gap-4">
            {user.profilePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed R2 URL; host not in next/image config
              <img
                src={user.profilePhotoUrl}
                alt=""
                className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-gray-100"
              />
            ) : (
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: '#C53030' }}
              >
                {initials}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900">{name}</p>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSuspendModal(true)}
            disabled={user.isFrozen}
            className={`rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors ${
              user.isFrozen
                ? 'cursor-not-allowed bg-gray-300'
                : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {user.isFrozen ? 'Account suspended' : 'Suspend account'}
          </button>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard label="Total amount invested" value={fmtMoney(user.totalInvested ?? '0')} />
          <MetricCard label="Wallet balance" value={fmtMoney(user.walletBalance ?? '0')} />
          <MetricCard label="Total referrals" value={String(user.totalReferrals ?? 0)} />
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-0">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-[#1a3a4a] text-[#1a3a4a]'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {tab === 'personal' && <PersonalInfoTab user={user} />}
        {tab === 'banks' && <LinkedBanksTab user={user} />}
        {tab === 'coholds' && <CoholdsTab />}
        {tab === 'transactions' && <TransactionsTab userId={user.id} userName={name} />}
      </div>

      {/* Suspend confirmation modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <UserIcon className="h-6 w-6 text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Suspend account</h2>
            <p className="mt-1.5 text-sm text-gray-500">
              Are you sure you want to suspend this account?
            </p>
            <div className="mt-7 flex gap-3">
              <button
                type="button"
                onClick={handleSuspend}
                disabled={acting}
                className="flex-1 rounded-lg border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {acting ? 'Suspending...' : 'Yes, suspend'}
              </button>
              <button
                type="button"
                onClick={() => setShowSuspendModal(false)}
                className="flex-1 rounded-lg bg-[#1a3a4a] py-3 text-sm font-medium text-white hover:opacity-90"
              >
                No, keep active
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Metric Card ─────────────────────────────────────── */

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-6 py-5">
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <p className="mt-2 text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

/* ── Info Row ────────────────────────────────────────── */

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-gray-900">{value || '\u2014'}</p>
    </div>
  );
}

/* ── Personal Info Tab ───────────────────────────────── */

function KycDocumentCard({ label, url }: { label: string; url: string | null | undefined }) {
  if (!url) {
    return (
      <div className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center">
        <p className="text-xs font-medium text-gray-600">{label}</p>
        <p className="mt-2 text-xs text-gray-400">Not uploaded</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
        <span className="text-xs font-medium text-gray-700">{label}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-[#1a3a4a] hover:underline"
        >
          Open <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div className="relative bg-[#fafafa]">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed URL; may be non-image */}
        <img
          src={url}
          alt=""
          className="mx-auto max-h-56 w-full object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <p className="px-3 py-2 text-center text-[11px] leading-snug text-gray-500">
          If preview is blank, use Open — file may be a PDF or unsupported format in-browser.
        </p>
      </div>
    </div>
  );
}

function KycReviewSection({ kyc }: { kyc: AdminUserKycVerification }) {
  const showExtraLegacy =
    Boolean(kyc.documentLegacyUrl) &&
    kyc.documentLegacyUrl !== kyc.documentFrontUrl;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 border-b border-gray-100 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <h3 className="text-sm font-semibold text-gray-700">KYC documents</h3>
        <div className="text-xs text-gray-500">
          <span className="text-gray-400">ID type: </span>
          {kyc.governmentIdType ?? '\u2014'}
          <span className="mx-2 text-gray-300">|</span>
          <span className="text-gray-400">ID number: </span>
          {kyc.governmentIdNumber ?? '\u2014'}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KycDocumentCard label="ID — front" url={kyc.documentFrontUrl} />
        <KycDocumentCard label="ID — back" url={kyc.documentBackUrl} />
        <KycDocumentCard label="Selfie" url={kyc.selfieUrl} />
        {showExtraLegacy && (
          <KycDocumentCard label="Legacy / additional document" url={kyc.documentLegacyUrl} />
        )}
      </div>
    </div>
  );
}

function PersonalInfoTab({ user }: { user: UserDetail }) {
  const kyc = user.kycVerification;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-5 text-sm font-semibold text-gray-700">Personal information</h3>
        <div className="mb-6 flex flex-col gap-4 border-b border-gray-100 pb-6 sm:flex-row sm:items-start">
          <div className="shrink-0">
            {user.profilePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.profilePhotoUrl}
                alt=""
                className="h-24 w-24 rounded-2xl object-cover ring-2 ring-gray-100"
              />
            ) : (
              <div
                className="flex h-24 w-24 items-center justify-center rounded-2xl text-xl font-semibold text-white"
                style={{ backgroundColor: '#C53030' }}
              >
                {(user.firstName?.[0] ?? user.email[0]).toUpperCase()}
                {(user.lastName?.[0] ?? '').toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900">Profile photo</p>
            <p className="mt-1 text-xs text-gray-500">
              {user.profilePhotoUrl
                ? 'Shown from stored file (signed URL, expires shortly).'
                : 'No profile photo on file.'}
            </p>
            {user.profilePhotoUrl && (
              <a
                href={user.profilePhotoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#1a3a4a] hover:underline"
              >
                Open full size <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-5 sm:grid-cols-3">
          <InfoRow label="User ID" value={`#${user.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`} />
          <InfoRow label="Full name" value={[user.firstName, user.lastName].filter(Boolean).join(' ') || null} />
          <InfoRow label="Email" value={user.email} />
          <InfoRow
            label="Phone number"
            value={user.phoneNumber ? `${user.phoneCountryCode ?? ''} ${user.phoneNumber}` : null}
          />
          <InfoRow
            label="KYC status"
            value={user.kycStatus === 'VERIFIED' ? 'Complete' : user.kycStatus}
          />
          <InfoRow label="Account status" value={user.isFrozen ? 'Restricted' : 'Active'} />
          <InfoRow label="Date of registration" value={fmtDate(user.createdAt)} />
        </div>
      </div>

      {kyc ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <KycReviewSection kyc={kyc} />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">
          No KYC verification record for this user.
        </div>
      )}
    </div>
  );
}

/* ── Linked Banks Tab ────────────────────────────────── */

function LinkedBanksTab({ user }: { user: UserDetail }) {
  const banks = user.linkedBanks ?? [];
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Linked banks</h3>
      {banks.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400">
          No linked banks.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {banks.map((b, i) => (
            <div
              key={b.id}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: BANK_COLORS[i % BANK_COLORS.length] }}
              >
                {b.bankName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold text-gray-900">{b.accountNumber}</p>
                <p className="truncate text-xs text-gray-400">
                  {b.bankName} &middot; {b.accountName}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Co-holds Tab ────────────────────────────────────── */

function CoholdsTab() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Coholds</h3>
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400">
        No co-holds yet.
      </div>
    </div>
  );
}

/* ── Transactions Tab ────────────────────────────────── */

function TransactionsTab({ userId, userName }: { userId: string; userName: string }) {
  const [txns, setTxns] = useState<UserTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<UserTransaction | null>(null);
  const limit = 10;
  const totalPages = Math.ceil(total / limit) || 1;

  const fetchTxns = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    adminApi
      .userTransactions(userId, params.toString())
      .then((d: any) => {
        setTxns(d.items ?? []);
        setTotal(d.meta?.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, page]);

  useEffect(() => {
    fetchTxns();
  }, [fetchTxns]);

  const pageNumbers: (number | '...')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pageNumbers.push(i);
    } else if (pageNumbers[pageNumbers.length - 1] !== '...') {
      pageNumbers.push('...');
    }
  }

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Transactions</h3>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">Amount</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">Transaction type</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">Date &amp; time</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">Status</th>
                  <th className="w-12 px-3 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        {Array.from({ length: 5 }).map((__, j) => (
                          <td key={j} className="px-5 py-4">
                            <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : txns.length === 0
                    ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-400">
                            No transactions.
                          </td>
                        </tr>
                      )
                    : txns.map((tx) => {
                        const statusInfo = TX_STATUS[tx.status] ?? TX_STATUS.PENDING;
                        return (
                          <tr key={tx.id} className="border-b border-gray-100 transition-colors hover:bg-gray-50/60">
                            <td className="px-5 py-4 text-sm font-medium text-gray-900">
                              {fmtMoney(tx.amount, tx.currency)}
                            </td>
                            <td className="px-5 py-4 text-sm text-gray-700">{txTypeLabel(tx.type)}</td>
                            <td className="px-5 py-4 text-sm text-gray-500">{fmtDate(tx.createdAt)}</td>
                            <td className="px-5 py-4">
                              <span className={`text-sm font-medium ${statusInfo.cls}`}>{statusInfo.label}</span>
                            </td>
                            <td className="px-3 py-4">
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === tx.id ? null : tx.id); }}
                                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                                {menuOpen === tx.id && (
                                  <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg">
                                    <button
                                      type="button"
                                      onClick={() => { setMenuOpen(null); setSelectedTx(tx); }}
                                      className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                      View details
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 border-t border-gray-200 px-5 py-3">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pageNumbers.map((n, i) =>
                n === '...' ? (
                  <span key={`dot-${i}`} className="flex h-8 w-8 items-center justify-center text-xs text-gray-400">...</span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      page === n ? 'bg-[#1a3a4a] text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {n}
                  </button>
                ),
              )}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Transaction detail panel */}
      {selectedTx && (
        <TransactionDetailPanel tx={selectedTx} userName={userName} onClose={() => setSelectedTx(null)} />
      )}
    </>
  );
}

/* ── Transaction Detail Panel ────────────────────────── */

function TransactionDetailPanel({
  tx,
  userName,
  onClose,
}: {
  tx: UserTransaction;
  userName: string;
  onClose: () => void;
}) {
  const statusInfo = TX_STATUS[tx.status] ?? TX_STATUS.PENDING;
  const meta = tx.metadata ?? {};

  const fields: { label: string; value: string }[] = [
    { label: 'Amount', value: fmtMoney(tx.amount, tx.currency) },
    { label: 'Status', value: statusInfo.label },
    { label: 'Transaction type', value: txTypeLabel(tx.type) },
  ];

  if (tx.type === 'P2P_TRANSFER') {
    fields.push(
      { label: 'Sending account number', value: meta.sendingAccountNumber ?? tx.reference },
      { label: 'Sending bank name', value: meta.sendingBankName ?? '\u2014' },
      { label: 'Sending bank name', value: userName },
    );
  } else if (tx.type === 'WALLET_WITHDRAWAL') {
    fields.push(
      { label: 'External account number', value: meta.externalAccountNumber ?? tx.externalReference ?? '\u2014' },
      { label: 'Sending bank name', value: meta.bankName ?? 'Regent Bank' },
      { label: 'Sending bank name', value: userName },
    );
  } else if (tx.type === 'WALLET_TOP_UP') {
    fields.push(
      { label: 'Sending account number', value: meta.sendingAccountNumber ?? tx.externalReference ?? '\u2014' },
      { label: 'Sending bank name', value: meta.bankName ?? '\u2014' },
      { label: 'Sending bank name', value: userName },
    );
  } else if (tx.type === 'DISTRIBUTION') {
    fields.push(
      { label: 'Invested capital', value: meta.investedCapital ? fmtMoney(meta.investedCapital, tx.currency) : '\u2014' },
      { label: 'Dividend based item', value: meta.propertyTitle ?? meta.propertyId ?? '\u2014' },
      { label: 'Dividend investment type', value: meta.investmentType ?? 'Fractional' },
    );
  } else if (tx.type === 'INVESTMENT') {
    fields.push(
      { label: 'Investment type', value: meta.investmentType ?? 'Fractional' },
      { label: 'Investment asset', value: meta.propertyTitle ?? meta.propertyId ?? '\u2014' },
    );
  } else if (tx.type === 'WALLET_SWAP') {
    fields.push(
      { label: 'Sending currency', value: meta.fromCurrency ?? tx.currency },
      { label: 'Receiving currency', value: meta.toCurrency ?? '\u2014' },
      { label: 'Swap amount', value: meta.swapAmount ? fmtMoney(meta.swapAmount) : '\u2014' },
    );
  }

  fields.push({ label: 'Date & time', value: fmtDate(tx.createdAt) });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="space-y-5">
              {fields.map((f, i) => (
                <div key={i}>
                  <p className="text-xs text-gray-400">{f.label}</p>
                  <p
                    className={`mt-0.5 text-sm font-medium ${
                      f.label === 'Status' ? statusInfo.cls : 'text-gray-900'
                    }`}
                  >
                    {f.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
