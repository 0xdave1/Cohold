'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/admin/api';
import type { PropertyListing } from '@/lib/admin/types';
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  SlidersHorizontal,
  Plus,
} from 'lucide-react';

const LIMIT = 10;

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PUBLISHED: { label: 'Active', cls: 'bg-green-50 text-green-600' },
  DRAFT: { label: 'Draft', cls: 'bg-gray-100 text-gray-500' },
  UNDER_REVIEW: { label: 'Review', cls: 'bg-amber-50 text-amber-600' },
  APPROVED: { label: 'Approved', cls: 'bg-blue-50 text-blue-600' },
  FUNDED: { label: 'Funded', cls: 'bg-blue-50 text-blue-600' },
  EXITED: { label: 'Closed', cls: 'bg-red-50 text-red-500' },
};

function shortId(id: string) {
  return `#${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

function fmtMoney(v: string | number, cur = 'NGN') {
  const symbols: Record<string, string> = { NGN: '\u20A6', USD: '$', GBP: '\u00A3', EUR: '\u20AC' };
  const n = typeof v === 'string' ? parseFloat(v) || 0 : v;
  return `${symbols[cur] ?? ''}${new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

function inferType(p: PropertyListing) {
  const desc = (p.description ?? '').toLowerCase();
  if (desc.includes('land')) return 'Land';
  if (desc.includes('own a home') || desc.includes('home')) return 'Own a home';
  return 'Fractional';
}

export default function PropertyListingsPage() {
  const router = useRouter();
  const [items, setItems] = useState<PropertyListing[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.ceil(total / LIMIT) || 1;
  const activeFilters = [statusFilter, typeFilter, periodFilter].filter(Boolean).length;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (statusFilter) params.set('status', statusFilter);
    if (typeFilter) params.set('type', typeFilter);
    if (periodFilter) params.set('period', periodFilter);
    adminApi
      .properties(params.toString())
      .then((d: any) => {
        setItems(d.items ?? d ?? []);
        setTotal(d.meta?.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, statusFilter, typeFilter, periodFilter]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null);
        setFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await adminApi.deleteProperty(id);
      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch { /* ignore */ }
    setMenuOpen(null);
  };

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
        <h1 className="text-lg font-semibold text-gray-900">Property/Listings</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen(!filterOpen)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filter{activeFilters > 0 ? ` ${activeFilters}` : ''}
            </button>
            {filterOpen && (
              <div
                ref={menuRef}
                className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-gray-200 bg-white py-2 shadow-lg"
              >
                <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</p>
                {[
                  { value: '', label: 'All' },
                  { value: 'fractional', label: 'Fractional' },
                  { value: 'land', label: 'Land' },
                  { value: 'own a home', label: 'Own a home' },
                ].map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { setTypeFilter(o.value); setPage(1); }}
                    className={`flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-gray-50 ${typeFilter === o.value ? 'font-medium text-gray-900' : 'text-gray-600'}`}
                  >
                    {o.label}
                    {typeFilter === o.value && <span className="text-[#1a3a4a]">&#10003;</span>}
                  </button>
                ))}
                <div className="my-1 border-t border-gray-100" />
                <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</p>
                {[
                  { value: '', label: 'All' },
                  { value: 'PUBLISHED', label: 'Active' },
                  { value: 'DRAFT', label: 'Draft' },
                  { value: 'EXITED', label: 'Closed' },
                ].map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { setStatusFilter(o.value); setPage(1); }}
                    className={`flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-gray-50 ${statusFilter === o.value ? 'font-medium text-gray-900' : 'text-gray-600'}`}
                  >
                    {o.label}
                    {statusFilter === o.value && <span className="text-[#1a3a4a]">&#10003;</span>}
                  </button>
                ))}
                <div className="my-1 border-t border-gray-100" />
                <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Time period</p>
                {[
                  { value: '', label: 'All time' },
                  { value: 'today', label: 'Today' },
                  { value: '7d', label: 'Last 7 days' },
                  { value: '30d', label: 'Last 30 days' },
                  { value: '180d', label: 'Last 180 days' },
                ].map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { setPeriodFilter(o.value); setPage(1); }}
                    className={`flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-gray-50 ${periodFilter === o.value ? 'font-medium text-gray-900' : 'text-gray-600'}`}
                  >
                    {o.label}
                    {periodFilter === o.value && <span className="text-[#1a3a4a]">&#10003;</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Link
            href="/admin/property-listings/add"
            className="flex items-center gap-2 rounded-lg bg-[#1a3a4a] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add a listing
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">ID</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">Property name &amp; location</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">Type</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">Value</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">Date &amp; time created</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">Status</th>
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
                : items.length === 0
                  ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-400">No listings found.</td>
                      </tr>
                    )
                  : items.map((p) => {
                      const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.DRAFT;
                      const type = p.listingType || inferType(p);
                      return (
                        <tr key={p.id} className="border-b border-gray-100 transition-colors hover:bg-gray-50/60">
                          <td className="px-5 py-4 text-sm font-medium text-gray-900">{shortId(p.id)}</td>
                          <td className="px-5 py-4">
                            <Link href={`/admin/property-listings/${p.id}`} className="group">
                              <p className="text-sm font-medium text-gray-900 group-hover:underline">{p.title}</p>
                              <p className="text-xs text-gray-400">{p.location}</p>
                            </Link>
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-700">{type}</td>
                          <td className="px-5 py-4 text-sm text-gray-700">{fmtMoney(p.totalValue, p.currency)}</td>
                          <td className="px-5 py-4 text-sm text-gray-500">{fmtDate(p.createdAt)}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                          </td>
                          <td className="px-3 py-4">
                            <div className="relative" ref={menuOpen === p.id ? menuRef : undefined}>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === p.id ? null : p.id); }}
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              {menuOpen === p.id && (
                                <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg">
                                  <button
                                    type="button"
                                    onClick={() => { setMenuOpen(null); router.push(`/admin/property-listings/${p.id}`); }}
                                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    View details
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(p.id)}
                                    className="block w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-gray-50"
                                  >
                                    Delete verification
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
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageNumbers.map((n, i) =>
              n === '...' ? (
                <span key={`dot-${i}`} className="flex h-8 w-8 items-center justify-center text-xs text-gray-400">...</span>
              ) : (
                <button key={n} type="button" onClick={() => setPage(n)} className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${page === n ? 'bg-[#1a3a4a] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {n}
                </button>
              ),
            )}
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
