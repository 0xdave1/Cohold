'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AdminReasonDialog } from '@/components/admin/AdminReasonDialog';
import { adminApi } from '@/lib/admin/api';
import type { PropertyDetail, PropertyInvestor } from '@/lib/admin/types';
import { canCloseProperty, canDeleteProperty, canPublishProperty, canManageProperties } from '@/lib/admin/permissions';
import { mapApiError } from '@/lib/api/security-errors';
import { useAuthStore } from '@/stores/auth.store';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  MoreHorizontal,
} from 'lucide-react';
import { listingTypePillLabel } from '@/lib/listings/category';
import Decimal from 'decimal.js';
import { formatDecimalMoneyForDisplay } from '@/lib/money/format-display';

type Tab = 'info' | 'features' | 'investors' | 'documents';

/* ── helpers ─────────────────────────────────────── */

function fmtMoney(v: string | number, cur = 'NGN') {
  const s = typeof v === 'number' ? String(v) : v;
  return formatDecimalMoneyForDisplay(s, cur);
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

function shortId(id: string) {
  return `#${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PUBLISHED: { label: 'Published', cls: 'bg-green-50 text-green-700' },
  DRAFT: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  CLOSED: { label: 'Closed', cls: 'bg-gray-200 text-gray-800' },
};

/* ── Main ────────────────────────────────────────── */

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const adminRole = useAuthStore((s) => s.adminRole);
  const allowPublish = canPublishProperty(adminRole);
  const allowClose = canCloseProperty(adminRole);
  const allowDelete = canDeleteProperty(adminRole);
  const allowEditListing = canManageProperties(adminRole);
  const [prop, setProp] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('info');
  const [closing, setClosing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [propertyDanger, setPropertyDanger] = useState<null | 'close' | 'delete'>(null);

  const fetchProperty = useCallback(async () => {
    if (!id) return;
    try {
      const d = await adminApi.propertyDetail(id);
      setProp(d);
      setLoadError(null);
    } catch (e: unknown) {
      setProp(null);
      setLoadError(mapApiError(e).message);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchProperty().finally(() => setLoading(false));
  }, [id, fetchProperty]);

  const handleCloseClick = () => {
    if (!id || !prop) return;
    setPropertyDanger('close');
  };

  const handlePublish = async () => {
    if (!id || !prop) return;
    if (!window.confirm('Publish this listing? Wallet distributions depend on accurate yield and inventory.')) return;
    setActionError(null);
    try {
      await adminApi.publishProperty(id);
      await fetchProperty();
    } catch (e: unknown) {
      setActionError(mapApiError(e).message);
    }
  };

  const handleDeleteClick = () => {
    if (!id || !prop) return;
    setPropertyDanger('delete');
  };

  const confirmPropertyDanger = async (reason: string) => {
    if (!id || !prop || !propertyDanger) return;
    setClosing(propertyDanger === 'close');
    setActionError(null);
    try {
      if (propertyDanger === 'close') {
        await adminApi.closeProperty(id, { reason });
        await fetchProperty();
      } else {
        await adminApi.deleteProperty(id, { reason });
        window.location.href = '/admin/property-listings';
      }
    } catch (e: unknown) {
      setActionError(mapApiError(e).message);
      throw e;
    } finally {
      setClosing(false);
    }
  };

  const confirmUnpublish = async (reason: string) => {
    if (!id) return;
    setActionError(null);
    try {
      await adminApi.unpublishProperty(id, { reason });
      setUnpublishOpen(false);
      await fetchProperty();
    } catch (e: unknown) {
      setActionError(mapApiError(e).message);
      throw e;
    }
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
        <p className="text-gray-500">{loadError ?? 'Property not found.'}</p>
      </div>
    );
  }

  const statusBadge = STATUS_BADGE[prop.status] ?? { label: prop.status, cls: 'bg-gray-100 text-gray-600' };
  const typeLabel = listingTypePillLabel(prop.listingType);
  const isPublished = prop.status === 'PUBLISHED';

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900">{prop.title}</h1>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge.cls}`}>{statusBadge.label}</span>
          {isPublished ? (
            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
              Live listing
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actionError ? (
            <span className="max-w-md text-xs text-red-700" role="alert">
              {actionError}
            </span>
          ) : null}
          {allowPublish && prop.status === 'DRAFT' ? (
            <button
              type="button"
              onClick={() => void handlePublish()}
              className="rounded-lg bg-[#1a3a4a] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Publish
            </button>
          ) : null}
          {allowPublish && prop.status === 'PUBLISHED' ? (
            <button
              type="button"
              onClick={() => setUnpublishOpen(true)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
            >
              Unpublish (to draft)
            </button>
          ) : null}
          {allowClose && prop.status !== 'CLOSED' ? (
            <button
              type="button"
              onClick={() => handleCloseClick()}
              disabled={closing}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {closing ? 'Closing…' : 'Close property'}
            </button>
          ) : null}
          {allowDelete ? (
            <button
              type="button"
              onClick={() => handleDeleteClick()}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Delete listing
            </button>
          ) : null}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Total investment value" value={fmtMoney(prop.totalValue, prop.currency)} />
        <MetricCard label="Listing type" value={typeLabel} />
        <MetricCard label="Total investors" value={String(prop.totalInvestors ?? prop.investorCount ?? 0)} />
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950 space-y-1">
        <p className="font-semibold">Listing compliance</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Do not mark title verified unless legal review is complete.</li>
          <li>Projected yield is not guaranteed — avoid guaranteed-return language in disclosures.</li>
          <li>Publish requires expected return and risk disclosures (minimum length enforced server-side).</li>
        </ul>
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

      {tab === 'info' && (
        <PropertyInfoTab prop={prop} propertyId={id} canEdit={allowEditListing} onReload={() => void fetchProperty()} />
      )}
      {tab === 'features' && <FeaturesTab prop={prop} />}
      {tab === 'investors' && <InvestorsTab propertyId={prop.id} />}
      {tab === 'documents' && <DocumentsTab prop={prop} />}

      <AdminReasonDialog
        open={unpublishOpen}
        title="Unpublish property"
        description="Moves the listing back to DRAFT. A reason is stored for audit when the server accepts it."
        confirmLabel="Unpublish"
        onClose={() => setUnpublishOpen(false)}
        onConfirm={confirmUnpublish}
      />
      <AdminReasonDialog
        open={propertyDanger != null}
        title={propertyDanger === 'close' ? 'Close property' : 'Delete listing'}
        description={
          propertyDanger === 'close'
            ? 'Closing stops new investments. A reason is required for audit.'
            : 'Soft-deletes the listing. A reason is required for audit.'
        }
        confirmLabel={propertyDanger === 'close' ? 'Close property' : 'Delete listing'}
        onClose={() => setPropertyDanger(null)}
        onConfirm={confirmPropertyDanger}
      />
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

function PropertyInfoTab({
  prop,
  propertyId,
  canEdit,
  onReload,
}: {
  prop: PropertyDetail;
  propertyId: string;
  canEdit: boolean;
  onReload: () => void;
}) {
  const sharesTotal = new Decimal(prop.sharesTotal || '0');
  const sharesSold = new Decimal(prop.sharesSold || '0');
  const oversold = sharesTotal.gt(0) && sharesSold.gt(sharesTotal);
  const available = sharesTotal.minus(sharesSold);
  const annualYield = prop.annualYield != null && String(prop.annualYield).trim() !== ''
    ? new Decimal(String(prop.annualYield)).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
    : null;
  const fundedPct = sharesTotal.gt(0)
    ? sharesSold.div(sharesTotal).times(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toFixed(1)
    : '0';
  const displayLoc = (prop.displayLocation && prop.displayLocation.trim()) || prop.location;

  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [form, setForm] = useState(() => buildEditForm(prop));

  useEffect(() => {
    setForm(buildEditForm(prop));
  }, [
    prop.id,
    prop.title,
    prop.description,
    prop.listingType,
    prop.annualYield,
    prop.termMonths,
    prop.expectedReturnDisclosure,
    prop.riskDisclosure,
    prop.titleVerificationStatus,
    prop.legalReviewStatus,
    prop.documentsAvailable,
    prop.developerName,
    prop.isListedPartnerDeveloper,
    prop.address,
    prop.city,
    prop.state,
    prop.country,
    prop.yieldBasis,
    prop.features,
  ]);

  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    setEditError(null);
    try {
      const termNum = form.termMonths.trim() === '' ? undefined : Number(form.termMonths);
      const body: Record<string, unknown> = {
        listingType: form.listingType,
        title: form.title.trim(),
        description: form.description.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim(),
        developerName: form.developerName.trim() || undefined,
        isListedPartnerDeveloper: form.isListedPartnerDeveloper,
        annualYield: form.annualYieldPercent.trim() || undefined,
        yieldBasis: form.yieldBasis,
        yieldIsProjected: form.yieldBasis !== 'HISTORICAL',
        expectedReturnDisclosure: form.expectedReturnDisclosure.trim() || undefined,
        riskDisclosure: form.riskDisclosure.trim() || undefined,
        titleVerificationStatus: form.titleVerificationStatus,
        legalReviewStatus: form.legalReviewStatus,
        documentsAvailable: form.documentsAvailable,
        features: form.featuresText.split('\n').map((s) => s.trim()).filter(Boolean),
      };
      if (termNum !== undefined && Number.isFinite(termNum) && termNum > 0) {
        body.termMonths = Math.round(termNum);
      }
      await adminApi.updateProperty(propertyId, body);
      await onReload();
    } catch (e: unknown) {
      setEditError(mapApiError(e).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {oversold ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <p className="font-semibold">Inventory inconsistency</p>
          <p className="mt-1">
            Shares sold exceed shares total in the current record. Publishing is blocked server-side until corrected.
          </p>
        </div>
      ) : null}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-5 text-sm font-semibold text-gray-700">Property information</h3>
        <div className="grid grid-cols-2 gap-x-10 gap-y-5 sm:grid-cols-3">
          <InfoRow label="Listing ID" value={shortId(prop.id)} />
          <InfoRow label="Listing type" value={listingTypePillLabel(prop.listingType)} />
          <InfoRow label="Property name" value={prop.title} />
          <InfoRow label="Display location" value={displayLoc} />
          <InfoRow label="Min investment amount" value={fmtMoney(prop.minInvestment, prop.currency)} valueColor="text-green-600" />
          <InfoRow label="Share price" value={fmtMoney(prop.sharePrice, prop.currency)} />
          <InfoRow
            label="Disclosed annual yield (basis for publish)"
            value={annualYield != null ? `${annualYield}% / year` : 'Not set — publish will fail until set in admin data'}
            valueColor={annualYield ? 'text-gray-900' : 'text-amber-700'}
          />
          <InfoRow label="Funded (% of share cap)" value={`${fundedPct}%`} />
          <InfoRow label="Capital subscribed (invested / total value)" value={`${prop.yieldPercentage ?? '0'}%`} />
          <InfoRow label="Total investment value" value={fmtMoney(prop.totalValue, prop.currency)} />
          <InfoRow label="Shares sold / total" value={`${sharesSold.toFixed()} / ${sharesTotal.toFixed()}`} />
          <InfoRow label="Shares available (computed)" value={available.gte(0) ? available.toFixed() : '—'} />
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

      {canEdit ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Edit listing contract</h3>
          {editError ? <p className="text-xs text-red-600">{editError}</p> : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs text-gray-500">
              Listing type
              <select
                value={form.listingType}
                onChange={(e) => setForm((f) => ({ ...f, listingType: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="FRACTIONAL_OWNERSHIP">Fractional</option>
                <option value="LAND_ACQUISITION">Land</option>
                <option value="OWN_A_HOME">Own a home</option>
              </select>
            </label>
            <label className="block text-xs text-gray-500">
              Yield basis
              <select
                value={form.yieldBasis}
                onChange={(e) => setForm((f) => ({ ...f, yieldBasis: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="PROJECTED">PROJECTED</option>
                <option value="HISTORICAL">HISTORICAL</option>
                <option value="UNSPECIFIED">UNSPECIFIED</option>
              </select>
            </label>
          </div>
          <label className="block text-xs text-gray-500">
            Title
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-gray-500">
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={4}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs text-gray-500">
              Address
              <input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-gray-500">
              City
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-gray-500">
              State
              <input
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-gray-500">
              Country
              <input
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block text-xs text-gray-500">
            Developer name
            <input
              value={form.developerName}
              onChange={(e) => setForm((f) => ({ ...f, developerName: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={form.isListedPartnerDeveloper}
              onChange={(e) => setForm((f) => ({ ...f, isListedPartnerDeveloper: e.target.checked }))}
            />
            Listed partner developer
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs text-gray-500">
              Annual yield (% per year, e.g. 12 for 12%)
              <input
                value={form.annualYieldPercent}
                onChange={(e) => setForm((f) => ({ ...f, annualYieldPercent: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-gray-500">
              Term (months)
              <input
                value={form.termMonths}
                onChange={(e) => setForm((f) => ({ ...f, termMonths: e.target.value }))}
                placeholder="e.g. 24"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs text-gray-500">
              Title verification status
              <select
                value={form.titleVerificationStatus}
                onChange={(e) => setForm((f) => ({ ...f, titleVerificationStatus: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {['UNSPECIFIED', 'PENDING', 'VERIFIED', 'REJECTED'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-gray-500">
              Legal review status
              <select
                value={form.legalReviewStatus}
                onChange={(e) => setForm((f) => ({ ...f, legalReviewStatus: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {['UNSPECIFIED', 'PENDING', 'APPROVED', 'REJECTED'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={form.documentsAvailable}
              onChange={(e) => setForm((f) => ({ ...f, documentsAvailable: e.target.checked }))}
            />
            Documents available (investor-facing flag)
          </label>
          <label className="block text-xs text-gray-500">
            Expected return disclosure
            <textarea
              value={form.expectedReturnDisclosure}
              onChange={(e) => setForm((f) => ({ ...f, expectedReturnDisclosure: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-gray-500">
            Risk disclosure
            <textarea
              value={form.riskDisclosure}
              onChange={(e) => setForm((f) => ({ ...f, riskDisclosure: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-gray-500">
            Features (one per line)
            <textarea
              value={form.featuresText}
              onChange={(e) => setForm((f) => ({ ...f, featuresText: e.target.value }))}
              rows={4}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-[#1a3a4a] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

type EditFormState = {
  listingType: string;
  title: string;
  description: string;
  address: string;
  city: string;
  state: string;
  country: string;
  developerName: string;
  isListedPartnerDeveloper: boolean;
  annualYieldPercent: string;
  yieldBasis: string;
  termMonths: string;
  expectedReturnDisclosure: string;
  riskDisclosure: string;
  titleVerificationStatus: string;
  legalReviewStatus: string;
  documentsAvailable: boolean;
  featuresText: string;
};

function buildEditForm(prop: PropertyDetail): EditFormState {
  const annualYieldPercent =
    prop.annualYield != null && String(prop.annualYield).trim() !== ''
      ? new Decimal(String(prop.annualYield)).times(100).toDecimalPlaces(8, Decimal.ROUND_HALF_UP).toFixed()
      : '';
  const trimmed = annualYieldPercent.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
  return {
    listingType: prop.listingType || 'FRACTIONAL_OWNERSHIP',
    title: prop.title,
    description: prop.description,
    address: prop.address ?? '',
    city: prop.city ?? '',
    state: prop.state ?? '',
    country: prop.country ?? '',
    developerName: prop.developerName ?? '',
    isListedPartnerDeveloper: Boolean(prop.isListedPartnerDeveloper),
    annualYieldPercent: trimmed,
    yieldBasis: prop.yieldBasis ?? 'PROJECTED',
    termMonths: prop.termMonths != null ? String(prop.termMonths) : '',
    expectedReturnDisclosure: prop.expectedReturnDisclosure ?? '',
    riskDisclosure: prop.riskDisclosure ?? '',
    titleVerificationStatus: prop.titleVerificationStatus ?? 'UNSPECIFIED',
    legalReviewStatus: prop.legalReviewStatus ?? 'UNSPECIFIED',
    documentsAvailable: Boolean(prop.documentsAvailable),
    featuresText: (prop.features ?? []).join('\n'),
  };
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
                : investors.map((inv) => {
                    const amountStr = inv.amount ?? inv.amountInvested ?? '0';
                    const cur = inv.currency ?? 'NGN';
                    const investedAt = inv.createdAt ?? inv.dateInvested ?? '';
                    return (
                    <tr key={inv.id} className="border-b border-gray-100 transition-colors hover:bg-gray-50/60">
                      <td className="px-5 py-4 text-sm font-medium text-gray-900">{inv.userName}</td>
                      <td className="px-5 py-4 text-sm text-gray-700">{fmtMoney(amountStr, cur)}</td>
                      <td className="px-5 py-4 text-sm text-gray-700">{fmtMoney(amountStr, cur)}</td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {new Decimal(inv.ownershipPercent || '0').toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed()}%
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-500">{investedAt ? fmtDate(investedAt) : '—'}</td>
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
