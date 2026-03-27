'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/admin/api';
import type { PlatformUser } from '@/lib/admin/types';
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  SlidersHorizontal,
} from 'lucide-react';

const LIMIT = 10;

const VERIFICATION_BADGE: Record<string, { label: string; cls: string }> = {
  VERIFIED: { label: 'Complete', cls: 'bg-green-50 text-green-600' },
  PENDING: { label: 'Pending', cls: 'bg-amber-50 text-amber-600' },
  FAILED: { label: 'Failed', cls: 'bg-red-50 text-red-600' },
  REQUIRES_REVIEW: { label: 'Review', cls: 'bg-blue-50 text-blue-600' },
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-green-50 text-green-600' },
  suspended: { label: 'Suspended', cls: 'bg-gray-100 text-gray-500' },
  deleted: { label: 'Deleted', cls: 'bg-red-50 text-red-500' },
};

function getAccountStatus(user: PlatformUser) {
  if (user.isFrozen) return 'suspended';
  return 'active';
}

function shortId(id: string) {
  return `#${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [kycFilter, setKycFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (kycFilter) params.set('kycStatus', kycFilter);
    adminApi
      .users(params.toString())
      .then((d: any) => {
        let items = d.items ?? d ?? [];
        if (statusFilter === 'active') items = items.filter((u: PlatformUser) => !u.isFrozen);
        if (statusFilter === 'suspended') items = items.filter((u: PlatformUser) => u.isFrozen);
        setUsers(items);
        setTotal(d.meta?.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, kycFilter, statusFilter]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null);
        setStatusDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSuspend = async (userId: string) => {
    try {
      await adminApi.suspendUser(userId);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isFrozen: true } : u)));
    } catch { /* ignore */ }
    setMenuOpen(null);
  };

  const handleDelete = async (userId: string) => {
    try {
      await adminApi.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch { /* ignore */ }
    setMenuOpen(null);
  };

  const activeFilters = [kycFilter, statusFilter].filter(Boolean).length;

  const pageNumbers: (number | '...')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pageNumbers.push(i);
    } else if (pageNumbers[pageNumbers.length - 1] !== '...') {
      pageNumbers.push('...');
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">User management</h1>
        <div className="relative">
          <button
            type="button"
            onClick={() => setStatusDropdown(statusDropdown ? null : '__filter')}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter{activeFilters > 0 ? ` ${activeFilters}` : ''}
          </button>
          {statusDropdown === '__filter' && (
            <div
              ref={menuRef}
              className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-gray-200 bg-white py-2 shadow-lg"
            >
              <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Verification</p>
              {['', 'VERIFIED', 'PENDING', 'FAILED'].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => { setKycFilter(v); setPage(1); }}
                  className={`flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-gray-50 ${kycFilter === v ? 'text-gray-900 font-medium' : 'text-gray-600'}`}
                >
                  {v || 'All'}
                  {kycFilter === v && <span className="text-[#1a3a4a]">&#10003;</span>}
                </button>
              ))}
              <div className="my-1 border-t border-gray-100" />
              <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Account status</p>
              {[
                { value: '', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'suspended', label: 'Restricted' },
              ].map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => { setStatusFilter(s.value); setPage(1); }}
                  className={`flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-gray-50 ${statusFilter === s.value ? 'text-gray-900 font-medium' : 'text-gray-600'}`}
                >
                  {s.label}
                  {statusFilter === s.value && <span className="text-[#1a3a4a]">&#10003;</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">ID</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">Full name & email</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">Account number</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">Date &amp; time/sort</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">Verification</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">Account status</th>
                <th className="w-12 px-3 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                : users.length === 0
                  ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-400">
                          No users found.
                        </td>
                      </tr>
                    )
                  : users.map((u) => {
                      const status = getAccountStatus(u);
                      const verif = VERIFICATION_BADGE[u.kycStatus] ?? VERIFICATION_BADGE.PENDING;
                      const acctBadge = STATUS_BADGE[status] ?? STATUS_BADGE.active;
                      const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';
                      return (
                        <tr key={u.id} className="border-b border-gray-100 transition-colors hover:bg-gray-50/60">
                          <td className="px-5 py-4 text-sm font-medium text-gray-900">
                            {shortId(u.id)}
                          </td>
                          <td className="px-5 py-4">
                            <Link href={`/admin/users/${u.id}`} className="group">
                              <p className="text-sm font-medium text-gray-900 group-hover:underline">{fullName}</p>
                              <p className="text-xs text-gray-400">{u.email}</p>
                            </Link>
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-700 font-mono">
                            {u.accountNumber ?? '—'}
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-500">
                            {fmtDate(u.createdAt)}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${verif.cls}`}>
                              {verif.label}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${acctBadge.cls}`}>
                              {acctBadge.label}
                            </span>
                          </td>
                          <td className="px-3 py-4">
                            <div className="relative" ref={menuOpen === u.id ? menuRef : undefined}>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === u.id ? null : u.id); }}
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              {menuOpen === u.id && (
                                <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg">
                                  <button
                                    type="button"
                                    onClick={() => { setMenuOpen(null); router.push(`/admin/users/${u.id}`); }}
                                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    View details
                                  </button>
                                  {!u.isFrozen && (
                                    <button
                                      type="button"
                                      onClick={() => handleSuspend(u.id)}
                                      className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                      Suspend account
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(u.id)}
                                    className="block w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-gray-50"
                                  >
                                    Delete user
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

        {/* Pagination */}
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
                    page === n
                      ? 'bg-[#1a3a4a] text-white'
                      : 'text-gray-600 hover:bg-gray-100'
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
  );
}
