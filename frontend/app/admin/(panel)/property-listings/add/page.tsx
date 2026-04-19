'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  adminUploadPropertyDocument,
  adminUploadPropertyImage,
  type PropertyDocType,
} from '@/lib/uploads/admin-presigned-upload';
import { clientUploadHint } from '@/lib/uploads/upload-validation-client';
import {
  ArrowLeft,
  FileText,
  DollarSign,
  FolderOpen,
  Image as ImageIcon,
  FileCheck,
  Eye,
  X,
  Upload,
} from 'lucide-react';

type Step = 'basic' | 'finance' | 'documentation' | 'media' | 'terms' | 'preview';

const STEPS: { key: Step; label: string; icon: typeof FileText }[] = [
  { key: 'basic', label: 'Basic information', icon: FileText },
  { key: 'finance', label: 'Finance', icon: DollarSign },
  { key: 'documentation', label: 'Documentation', icon: FolderOpen },
  { key: 'media', label: 'Media', icon: ImageIcon },
  { key: 'terms', label: 'Terms & conditions', icon: FileCheck },
  { key: 'preview', label: 'Preview', icon: Eye },
];

const PROPERTY_TYPES = ['Fractional', 'Land', 'Own a home'];
const DEFAULT_FEATURES = [
  'Electricity', 'Security', 'Internet connectivity', 'Accessibility',
  'Proximate to recreation spots', 'Modern style', 'Gym & fitness', 'Working centres',
];
const DOC_TYPES = [
  'Certificate of Occupancy', 'Right of Occupancy', 'Deed of Agreement',
  'Corporate Affairs Commission (CAC) registration',
];

/** Maps UI document labels to backend `PropertyDocument.type` enum. */
function mapDocLabelToApiType(label: string): PropertyDocType {
  const l = (label || '').toLowerCase();
  if (l.includes('deed')) return 'DEED';
  if (l.includes('survey')) return 'SURVEY';
  if (l.includes('occupancy') || l.includes('certificate') || l.includes('right of')) return 'TITLE';
  return 'OTHER';
}

interface FormData {
  propertyType: string;
  propertyName: string;
  plotSize: string;
  country: string;
  state: string;
  city: string;
  developer: string;
  description: string;
  features: string[];
  totalPropertyValue: string;
  currency: string;
  totalShares: string;
  unitSharePrice: string;
  minInvestmentAmount: string;
  investmentTenure: string;
  tenureUnit: string;
  totalPropertyYield: string;
  instalmentAllowed: string;
  monthlyPayment: string;
  initialDepositRequired: string;
  initialDepositAmount: string;
  documents: { name: string; type: string; file: File | null }[];
  coverImage: File | null;
  additionalImages: File[];
  terms: string;
}

const initial: FormData = {
  propertyType: '',
  propertyName: '',
  plotSize: '',
  country: '',
  state: '',
  city: '',
  developer: '',
  description: '',
  features: [],
  totalPropertyValue: '',
  currency: 'NGN',
  totalShares: '',
  unitSharePrice: '',
  minInvestmentAmount: '',
  investmentTenure: '',
  tenureUnit: 'year',
  totalPropertyYield: '',
  instalmentAllowed: 'No',
  monthlyPayment: '',
  initialDepositRequired: 'No',
  initialDepositAmount: '',
  documents: [],
  coverImage: null,
  additionalImages: [],
  terms: '',
};

export default function AddListingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('basic');
  const [form, setForm] = useState<FormData>(initial);
  const [newFeature, setNewFeature] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<'idle' | 'creating' | 'uploading'>('idle');

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addFeature = () => {
    const v = newFeature.trim();
    if (v && !form.features.includes(v)) {
      set('features', [...form.features, v]);
    }
    setNewFeature('');
  };

  const removeFeature = (f: string) => set('features', form.features.filter((x) => x !== f));

  const isFractional = form.propertyType === 'Fractional';

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitPhase('creating');
    try {
      const body = {
        title: form.propertyName.trim(),
        description: form.description.trim(),
        location: [form.city, form.state, form.country].filter(Boolean).join(', '),
        currency: form.currency,
        totalValue: form.totalPropertyValue.replace(/,/g, ''),
        sharesTotal: (form.totalShares || '1').replace(/,/g, ''),
        minInvestment: (form.minInvestmentAmount || '0').replace(/,/g, ''),
        sharePrice: form.unitSharePrice?.trim()
          ? form.unitSharePrice.replace(/,/g, '')
          : undefined,
      };

      const res = await fetch('/api/admin/proxy/admin/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.message === 'string'
            ? data.message
            : typeof data?.error === 'string'
              ? data.error
              : 'Failed to create property',
        );
      }

      const propertyId: string | undefined = data?.data?.id ?? data?.id;
      if (!propertyId) {
        throw new Error('Property was created but no id was returned.');
      }

      setSubmitPhase('uploading');
      const uploadErrors: string[] = [];

      if (form.coverImage) {
        try {
          await adminUploadPropertyImage(propertyId, form.coverImage, 0);
        } catch (e) {
          uploadErrors.push(
            `Cover image: ${e instanceof Error ? e.message : 'upload failed'}`,
          );
        }
      }

      let position = 1;
      for (const file of form.additionalImages) {
        try {
          await adminUploadPropertyImage(propertyId, file, position);
          position += 1;
        } catch (e) {
          uploadErrors.push(
            `${file.name}: ${e instanceof Error ? e.message : 'upload failed'}`,
          );
        }
      }

      for (const doc of form.documents) {
        if (!doc.file) continue;
        try {
          await adminUploadPropertyDocument(
            propertyId,
            doc.file,
            mapDocLabelToApiType(doc.type),
          );
        } catch (e) {
          uploadErrors.push(
            `${doc.name}: ${e instanceof Error ? e.message : 'upload failed'}`,
          );
        }
      }

      if (uploadErrors.length > 0) {
        alert(
          `Listing created. Some files could not be uploaded — you can add them from the property page.\n\n${uploadErrors.join('\n')}`,
        );
      }

      router.push(`/admin/property-listings/${propertyId}`);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to create property');
    } finally {
      setSubmitting(false);
      setSubmitPhase('idle');
    }
  };

  return (
    <div className="space-y-5">
      <Link href="/admin/property-listings" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="flex gap-6">
        {/* Step sidebar */}
        <div className="w-56 shrink-0">
          <nav className="space-y-1">
            {STEPS.map((s) => {
              const active = step === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStep(s.key)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#1a3a4a] text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <s.icon className="h-4 w-4" />
                  {s.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {step === 'basic' && (
            <BasicInfoStep form={form} set={set} features={form.features} newFeature={newFeature} setNewFeature={setNewFeature} addFeature={addFeature} removeFeature={removeFeature} />
          )}
          {step === 'finance' && <FinanceStep form={form} set={set} isFractional={isFractional} />}
          {step === 'documentation' && <DocumentationStep form={form} set={set} />}
          {step === 'media' && <MediaStep form={form} set={set} />}
          {step === 'terms' && <TermsStep form={form} set={set} />}
          {step === 'preview' && (
            <PreviewStep
              form={form}
              onSubmit={handleSubmit}
              submitting={submitting}
              submitPhase={submitPhase}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Form Components ────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-gray-700">{children}</label>;
}

function Input({ value, onChange, placeholder, suffix }: { value: string; onChange: (v: string) => void; placeholder?: string; suffix?: string }) {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{suffix}</span>}
    </div>
  );
}

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/* ── Basic Info Step ─────────────────────────────── */

function BasicInfoStep({
  form, set, features, newFeature, setNewFeature, addFeature, removeFeature,
}: {
  form: FormData;
  set: <K extends keyof FormData>(k: K, v: FormData[K]) => void;
  features: string[];
  newFeature: string;
  setNewFeature: (v: string) => void;
  addFeature: () => void;
  removeFeature: (f: string) => void;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>

      <div>
        <Label>Property type</Label>
        <Select value={form.propertyType} onChange={(v) => set('propertyType', v)} options={PROPERTY_TYPES} placeholder="Select property type" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Property name</Label>
          <Input value={form.propertyName} onChange={(v) => set('propertyName', v)} placeholder="e.g. Metropolitan Luxury Homes" />
        </div>
        <div>
          <Label>Plot size</Label>
          <Input value={form.plotSize} onChange={(v) => set('plotSize', v)} placeholder="e.g. 500" suffix="sqm" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Country</Label>
          <Select value={form.country} onChange={(v) => set('country', v)} options={['Nigeria']} placeholder="Select country" />
        </div>
        <div>
          <Label>State</Label>
          <Input value={form.state} onChange={(v) => set('state', v)} placeholder="Select state" />
        </div>
        <div>
          <Label>City</Label>
          <Input value={form.city} onChange={(v) => set('city', v)} placeholder="Select city" />
        </div>
      </div>

      <div>
        <Label>Property developer</Label>
        <Input value={form.developer} onChange={(v) => set('developer', v)} placeholder="e.g. Santos Developers & Realty" />
      </div>

      <div>
        <Label>Property description</Label>
        <textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          rows={4}
          placeholder="Write a detailed description of this property."
          className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        />
      </div>

      <div>
        <Label>Property features</Label>
        <div className="mb-3 flex flex-wrap gap-2">
          {features.map((f) => (
            <span key={f} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700">
              {f}
              <button type="button" onClick={() => removeFeature(f)} className="text-gray-400 hover:text-gray-600">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newFeature}
            onChange={(e) => setNewFeature(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
            placeholder="Type a feature and use comma to separate"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          />
        </div>
        {features.length === 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DEFAULT_FEATURES.map((f) => (
              <button key={f} type="button" onClick={() => set('features', [...features, f])} className="rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600">
                + {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Finance Step ────────────────────────────────── */

function FinanceStep({ form, set, isFractional }: { form: FormData; set: <K extends keyof FormData>(k: K, v: FormData[K]) => void; isFractional: boolean }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Finance</h2>

      {isFractional ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Total property value</Label>
              <Input value={form.totalPropertyValue} onChange={(v) => set('totalPropertyValue', v)} placeholder="e.g. 500,000,000.00" suffix={form.currency} />
            </div>
            <div>
              <Label>Total shares</Label>
              <Input value={form.totalShares} onChange={(v) => set('totalShares', v)} placeholder="e.g. 1000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Unit share price</Label>
              <Input value={form.unitSharePrice} onChange={(v) => set('unitSharePrice', v)} placeholder="Auto-calculated" />
            </div>
            <div>
              <Label>Minimum investment amount</Label>
              <Input value={form.minInvestmentAmount} onChange={(v) => set('minInvestmentAmount', v)} placeholder="e.g. 50,000,000.00" suffix={form.currency} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Total property value</Label>
              <Input value={form.totalPropertyYield} onChange={(v) => set('totalPropertyYield', v)} suffix="%" />
            </div>
            <div>
              <Label>Investment tenure</Label>
              <div className="flex gap-2">
                <Input value={form.investmentTenure} onChange={(v) => set('investmentTenure', v)} placeholder="e.g. 1" />
                <Select value={form.tenureUnit} onChange={(v) => set('tenureUnit', v)} options={['year', 'months']} />
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Total property value</Label>
              <Input value={form.totalPropertyValue} onChange={(v) => set('totalPropertyValue', v)} placeholder="e.g. 500,000,000.00" suffix={form.currency} />
            </div>
            <div>
              <Label>Instalment allowed</Label>
              <Select value={form.instalmentAllowed} onChange={(v) => set('instalmentAllowed', v)} options={['Yes', 'No']} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Investment tenure</Label>
              <Input value={form.investmentTenure} onChange={(v) => set('investmentTenure', v)} placeholder="e.g. 12" suffix="months" />
            </div>
            {form.instalmentAllowed === 'Yes' && (
              <div>
                <Label>Monthly payment amount</Label>
                <Input value={form.monthlyPayment} onChange={(v) => set('monthlyPayment', v)} placeholder="5,000,000.00" suffix={form.currency} />
              </div>
            )}
          </div>
          {form.instalmentAllowed === 'Yes' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Initial deposit required</Label>
                <Select value={form.initialDepositRequired} onChange={(v) => set('initialDepositRequired', v)} options={['Yes', 'No']} />
              </div>
              {form.initialDepositRequired === 'Yes' && (
                <div>
                  <Label>Initial deposit amount</Label>
                  <Input value={form.initialDepositAmount} onChange={(v) => set('initialDepositAmount', v)} placeholder="e.g. 5,000,000.00" suffix={form.currency} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Documentation Step ──────────────────────────── */

function DocumentationStep({ form, set }: { form: FormData; set: <K extends keyof FormData>(k: K, v: FormData[K]) => void }) {
  const [showModal, setShowModal] = useState(false);
  const [docType, setDocType] = useState('');

  const addDoc = (file: File) => {
    set('documents', [...form.documents, { name: file.name, type: docType || 'Document', file }]);
    setShowModal(false);
    setDocType('');
  };

  const removeDoc = (idx: number) => set('documents', form.documents.filter((_, i) => i !== idx));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Documentation</h2>
        <button type="button" onClick={() => setShowModal(true)} className="rounded-lg bg-[#1a3a4a] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          Add a document
        </button>
      </div>

      {form.documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center text-sm text-gray-400">
          No documents added yet. Click &quot;Add a document&quot; to upload.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {form.documents.map((doc, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                <FileText className="h-5 w-5 text-gray-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{doc.type}</p>
                <p className="text-xs text-gray-400">{doc.name}</p>
              </div>
              <button type="button" onClick={() => removeDoc(i)} className="text-red-400 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Add a document</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="mb-4">
              <Label>Document type</Label>
              <Select value={docType} onChange={setDocType} options={DOC_TYPES} placeholder="Select document type" />
            </div>
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 px-6 py-8 transition-colors hover:border-gray-400">
              <Upload className="h-6 w-6 text-gray-400" />
              <p className="text-sm text-gray-500"><span className="font-medium text-[#1a3a4a]">Click to upload</span> or drag and drop</p>
              <p className="text-xs text-gray-400">{clientUploadHint('propertyDocument')}</p>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) addDoc(e.target.files[0]);
                }}
              />
            </label>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-lg bg-[#1a3a4a] py-2.5 text-sm font-medium text-white hover:opacity-90">Add document</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Media Step ──────────────────────────────────── */

function MediaStep({ form, set }: { form: FormData; set: <K extends keyof FormData>(k: K, v: FormData[K]) => void }) {
  const coverPreview = form.coverImage ? URL.createObjectURL(form.coverImage) : null;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Media</h2>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Upload a cover image</p>
        {coverPreview ? (
          <div className="relative inline-block">
            <Image
              src={coverPreview}
              alt="Property cover preview"
              width={256}
              height={160}
              unoptimized
              className="h-40 w-64 rounded-lg object-cover"
            />
            <button type="button" onClick={() => set('coverImage', null)} className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 px-6 py-10 transition-colors hover:border-gray-400">
            <Upload className="h-6 w-6 text-gray-400" />
            <p className="text-sm text-gray-400">Upload image</p>
            <p className="text-xs text-gray-400">{clientUploadHint('propertyImage')}</p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) set('coverImage', e.target.files[0]); }}
            />
          </label>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Upload additional images</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {form.additionalImages.map((img, i) => {
            const url = URL.createObjectURL(img);
            return (
              <div key={i} className="relative aspect-[4/3] overflow-hidden rounded-lg">
                <Image
                  src={url}
                  alt={`Additional property image preview ${i + 1}`}
                  width={400}
                  height={300}
                  unoptimized
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => set('additionalImages', form.additionalImages.filter((_, idx) => idx !== i))}
                  className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
          <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 transition-colors hover:border-gray-400">
            <Upload className="h-5 w-5 text-gray-400" />
            <span className="text-xs text-gray-400">Upload additional images</span>
            <span className="text-[10px] text-gray-400">{clientUploadHint('propertyImage')}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files) set('additionalImages', [...form.additionalImages, ...Array.from(e.target.files)]); }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

/* ── Terms Step ──────────────────────────────────── */

function TermsStep({ form, set }: { form: FormData; set: <K extends keyof FormData>(k: K, v: FormData[K]) => void }) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-gray-900">Terms &amp; conditions</h2>
      <textarea
        value={form.terms}
        onChange={(e) => set('terms', e.target.value)}
        rows={12}
        placeholder="Type terms & conditions"
        className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
      />
    </div>
  );
}

/* ── Preview Step ────────────────────────────────── */

function PreviewStep({
  form,
  onSubmit,
  submitting,
  submitPhase,
}: {
  form: FormData;
  onSubmit: () => void;
  submitting: boolean;
  submitPhase: 'idle' | 'creating' | 'uploading';
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Preview</h2>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Basic Information</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-400">Property type:</span> <span className="ml-2 font-medium text-gray-900">{form.propertyType || '\u2014'}</span></div>
          <div><span className="text-gray-400">Name:</span> <span className="ml-2 font-medium text-gray-900">{form.propertyName || '\u2014'}</span></div>
          <div><span className="text-gray-400">Location:</span> <span className="ml-2 font-medium text-gray-900">{[form.city, form.state, form.country].filter(Boolean).join(', ') || '\u2014'}</span></div>
          <div><span className="text-gray-400">Developer:</span> <span className="ml-2 font-medium text-gray-900">{form.developer || '\u2014'}</span></div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Finance</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-400">Total value:</span> <span className="ml-2 font-medium text-gray-900">{form.totalPropertyValue || '\u2014'} {form.currency}</span></div>
          <div><span className="text-gray-400">Shares:</span> <span className="ml-2 font-medium text-gray-900">{form.totalShares || '\u2014'}</span></div>
          <div><span className="text-gray-400">Min investment:</span> <span className="ml-2 font-medium text-gray-900">{form.minInvestmentAmount || '\u2014'}</span></div>
        </div>
      </div>

      {form.features.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Features</h3>
          <div className="flex flex-wrap gap-2">
            {form.features.map((f) => (
              <span key={f} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700">{f}</span>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="rounded-lg bg-[#1a3a4a] px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting
            ? submitPhase === 'uploading'
              ? 'Uploading media...'
              : submitPhase === 'creating'
                ? 'Creating listing...'
                : 'Submitting...'
            : 'Create listing'}
        </button>
      </div>
    </div>
  );
}
