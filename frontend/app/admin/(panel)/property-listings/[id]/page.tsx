'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { adminApi } from '@/lib/admin/api';
import type { PropertyDetail, PropertyInvestor } from '@/lib/admin/types';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  MoreHorizontal,
} from 'lucide-react';

type Tab = 'info' | 'features' | 'investors' | 'documents';

/* ── helpers ─────────────────────────────────────── */

function fmtMoney(v: string | number, cur = 'NGN') {
  const symbols: Record<string, string> = { NGN: '\u20A6', USD: '$', GBP: '\u00A3', EUR: '\u20AC' };
  const n = typeof v === 'string' ? parseFloat(v) || 0 : v;
  return `${symbols[cur] ?? ''}${new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

function shortId(id: string) {
  return `#${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

function inferType(desc: string) {
  const d = (desc ?? '').toLowerCase();
  if (d.includes('land')) return 'Land';
  if (d.includes('own a home') || d.includes('home')) return 'Own a home';
  return 'Fractional';
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PUBLISHED: { label: 'Active', cls: 'bg-green-50 text-green-600' },
  DRAFT: { label: 'Draft', cls: 'bg-gray-100 text-gray-500' },
  UNDER_REVIEW: { label: 'Review', cls: 'bg-amber-50 text-amber-600' },
  APPROVED: { label: 'Approved', cls: 'bg-blue-50 text-blue-600' },
  FUNDED: { label: 'Funded', cls: 'bg-blue-50 text-blue-600' },
  EXITED: { label: 'Closed', cls: 'bg-red-50 text-red-500' },
};

const OPEN_BADGE = { label: 'Open', cls: 'bg-green-50 text-green-600' };

/* ── Main ────────────────────────────────────────── */

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [prop, setProp] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('info');
  const [closing, setClosing] = useState(false);

  const fetchProperty = useCallback(async () => {
    if (!id) return;
    try {
      const d = await adminApi.propertyDetail(id);
      setProp(d);
    } catch {
      /* ignore */
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchProperty().finally(() => setLoading(false));
  }, [id, fetchProperty]);

  const handleClose = async () => {
    if (!id || !prop) return;
    setClosing(true);
    try {
      await adminApi.closeProperty(id);
      setProp((p) => (p ? { ...p, status: 'EXITED' } : p));
    } catch { /* ignore */ }
    setClosing(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/property-listings" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="h-6 w-52 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="h-24 animate-pulse rounded-xl border border-gray-200 bg-white" />
      </div>
    );
  }

  if (!prop) {
    return (
      <div className="space-y-6">
        <Link href="/admin/property-listings" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <p className="text-gray-500">Property not found.</p>
      </div>
    );
  }

  const statusBadge = STATUS_BADGE[prop.status] ?? STATUS_BADGE.DRAFT;
  const type = prop.listingType || inferType(prop.description);
  const isOpen = prop.status === 'PUBLISHED' || prop.status === 'APPROVED';

  const TABS: { key: Tab; label: string }[] = [
    { key: 'info', label: 'Property info' },
    { key: 'features', label: 'Property features & pictures' },
    { key: 'investors', label: 'Investors' },
    { key: 'documents', label: 'Documents' },
  ];

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/admin/property-listings" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900">{prop.title}</h1>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge.cls}`}>{statusBadge.label}</span>
          {isOpen && <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${OPEN_BADGE.cls}`}>{OPEN_BADGE.label}</span>}
        </div>
        <div className="flex items-center gap-2">
          {prop.status !== 'EXITED' && (
            <button
              type="button"
              onClick={handleClose}
              disabled={closing}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              {closing ? 'Closing...' : 'Close property'}
            </button>
          )}
          <span className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-500">
            Edit details (coming soon)
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Total investment value" value={fmtMoney(prop.totalValue, prop.currency)} />
        <MetricCard label="Investment type" value={type} />
        <MetricCard label="Total investors" value={String(prop.totalInvestors ?? prop.investorCount ?? 0)} />
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
                tab === t.key ? 'border-[#1a3a4a] text-[#1a3a4a]' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'info' && <PropertyInfoTab prop={prop} />}
      {tab === 'features' && <FeaturesTab prop={prop} />}
      {tab === 'investors' && <InvestorsTab propertyId={prop.id} />}
      {tab === 'documents' && <DocumentsTab prop={prop} />}
    </div>
  );
}

/* ── Metric Card ─────────────────────────────────── */

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-6 py-5">
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <p className="mt-2 text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

/* ── Info Row ────────────────────────────────────── */

function InfoRow({ label, value, valueColor }: { label: string; value: string | null | undefined; valueColor?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`mt-0.5 text-sm font-medium ${valueColor ?? 'text-gray-900'}`}>{value || '\u2014'}</p>
    </div>
  );
}

/* ── Property Info Tab ───────────────────────────── */

function PropertyInfoTab({ prop }: { prop: PropertyDetail }) {
  const sharesTotal = parseFloat(prop.sharesTotal) || 0;
  const sharesSold = parseFloat(prop.sharesSold) || 0;
  const yieldPct = prop.yieldPercentage ?? (sharesTotal > 0 ? ((sharesSold / sharesTotal) * 100).toFixed(1) : '0');

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-5 text-sm font-semibold text-gray-700">Property information</h3>
        <div className="grid grid-cols-2 gap-x-10 gap-y-5 sm:grid-cols-3">
          <InfoRow label="Listing ID" value={shortId(prop.id)} />
          <InfoRow label="Property name" value={prop.title} />
          <InfoRow label="Location" value={prop.location} />
          <InfoRow label="Min investment amount" value={fmtMoney(prop.minInvestment, prop.currency)} valueColor="text-green-600" />
          <InfoRow label="Share price" value={fmtMoney(prop.sharePrice, prop.currency)} />
          <InfoRow label="Yield" value={`${yieldPct}%`} />
          <InfoRow label="Total investment value" value={fmtMoney(prop.totalValue, prop.currency)} />
          <InfoRow label="Total shares" value={String(sharesTotal)} />
          <InfoRow label="Date listed" value={fmtDate(prop.createdAt)} />
        </div>
      </div>

      {/* Description */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Property description</h3>
        <p className="text-sm leading-relaxed text-gray-600">
          {prop.description || 'No description provided.'}
        </p>
      </div>
    </div>
  );
}

/* ── Features & Pictures Tab ─────────────────────── */

function FeaturesTab({ prop }: { prop: PropertyDetail }) {
  const features = prop.features ?? [];
  const images = prop.images ?? [];

  return (
    <div className="space-y-6">
      {/* Features */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Property features</h3>
        {features.length === 0 ? (
          <p className="text-sm text-gray-400">No features listed.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {features.map((f) => (
              <span key={f} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700">
                {f}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Pictures */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Property pictures</h3>
        {images.length === 0 ? (
          <p className="text-sm text-gray-400">No images uploaded.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {images.map((img) => (
              <div key={img.id} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-gray-100">
                {img.url ? (
                  <Image
                    src={img.url}
                    alt={`Property image ${img.position}`}
                    width={400}
                    height={300}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-[120px] items-center justify-center px-2 text-center text-xs text-gray-400">
                    Preview unavailable
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-xs text-gray-400">
          Media uploads are managed from the listing creation flow.
        </p>
      </div>
    </div>
  );
}

/* ── Investors Tab ───────────────────────────────── */

function InvestorsTab({ propertyId }: { propertyId: string }) {
  const [investors, setInvestors] = useState<PropertyInvestor[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const limit = 10;
  const totalPages = Math.ceil(total / limit) || 1;

  const fetchInvestors = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    adminApi
      .propertyInvestors(propertyId, params.toString())
      .then((d: any) => {
        setInvestors(d.items ?? []);
        setTotal(d.meta?.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [propertyId, page]);

  useEffect(() => {
    fetchInvestors();
  }, [fetchInvestors]);

  const pageNumbers: (number | '...')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pageNumbers.push(i);
    } else if (pageNumbers[pageNumbers.length - 1] !== '...') {
      pageNumbers.push('...');
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">Name</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">Amount invested</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">Investment value</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">Share amount</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500">Date &amp; time invested</th>
              <th className="w-12 px-3 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-5 py-4"><div className="h-4 w-20 animate-pulse rounded bg-gray-100" /></td>
                    ))}
                  </tr>
                ))
              : investors.length === 0
                ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">No investors yet.</td>
                    </tr>
                  )
                : investors.map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-100 transition-colors hover:bg-gray-50/60">
                      <td className="px-5 py-4 text-sm font-medium text-gray-900">{inv.userName}</td>
                      <td className="px-5 py-4 text-sm text-gray-700">{fmtMoney(inv.amount, inv.currency)}</td>
                      <td className="px-5 py-4 text-sm text-gray-700">{fmtMoney(inv.amount, inv.currency)}</td>
                      <td className="px-5 py-4 text-sm text-gray-700">{parseFloat(inv.ownershipPercent || '0').toFixed(0)}%</td>
                      <td className="px-5 py-4 text-sm text-gray-500">{fmtDate(inv.createdAt)}</td>
                      <td className="px-3 py-4">
                        <button
                          type="button"
                          onClick={() => setMenuOpen(menuOpen === inv.id ? null : inv.id)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
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
  );
}

/* ── Documents Tab ───────────────────────────────── */

function DocumentsTab({ prop }: { prop: PropertyDetail }) {
  const docs = prop.documents ?? [];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Documents</h3>

      {docs.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400">
          No documents uploaded.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                <FileText className="h-5 w-5 text-gray-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{doc.type || 'Document'}</p>
                <p className="text-xs text-gray-400">Stored securely</p>
              </div>
              {doc.url ? (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-gray-400 hover:text-gray-600"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </a>
              ) : (
                <span className="shrink-0 text-xs text-gray-300" title="Link unavailable">
                  —
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-400">
        Document uploads are managed from the listing creation flow.
      </p>
    </div>
  );
}
