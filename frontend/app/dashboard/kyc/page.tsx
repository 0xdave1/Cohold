'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Check, ChevronDown, ShieldCheck, X } from 'lucide-react';
import { useSubmitBvn, useSubmitNin, useKycStatus, useKycDocumentUpload } from '@/lib/hooks/use-kyc';
import { getApiErrorMessage } from '@/lib/api/errors';
import { DocumentUploader } from '@/components/upload/DocumentUploader';
import type { KycDocType } from '@/lib/uploads/upload-file';
import { type KycStatusNormalized } from '@/lib/kyc/status';

function statusCopy(status: KycStatusNormalized) {
  switch (status) {
    case 'NOT_STARTED':
      return { title: 'KYC not started', body: 'Submit your identity and documents to begin compliance review.' };
    case 'PENDING_REVIEW':
      return { title: 'KYC submitted — under review', body: 'Your details are under compliance review. This is not an approval yet.' };
    case 'RESUBMITTED':
      return { title: 'KYC resubmitted — under review', body: 'Your updated details were received and are pending review.' };
    case 'MANUAL_REVIEW':
      return { title: 'Manual review in progress', body: 'Your verification requires human review before a final decision.' };
    case 'REQUIRES_REVIEW':
      return { title: 'Additional review required', body: 'Your account is in compliance review. Money actions remain restricted.' };
    case 'REJECTED':
      return { title: 'KYC rejected', body: 'Your verification was not approved. Please update details and resubmit.' };
    case 'REVOKED':
      return { title: 'KYC revoked', body: 'Verification was revoked. Please contact support and complete review again.' };
    case 'VERIFIED':
      return { title: 'KYC verified', body: 'Your account is verified and can access money actions subject to policy.' };
    default:
      return { title: 'KYC status unavailable', body: 'We could not confirm your KYC status. Money actions remain restricted until status is known.' };
  }
}

function sanitizeIdentityErrorMessage(message: string): string {
  return message.replace(/\b\d{6,}\b/g, '***');
}

export default function KycWizardPage() {
  const [method, setMethod] = useState<'bvn' | 'nin' | null>(null);
  const [bvn, setBvn] = useState('');
  const [nin, setNin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isMethodPickerOpen, setIsMethodPickerOpen] = useState(false);

  const { data: kycStatus } = useKycStatus();
  const submitBvn = useSubmitBvn();
  const submitNin = useSubmitNin();
  const kycDocUpload = useKycDocumentUpload();

  const bvnValid = useMemo(() => bvn.length === 11 && /^\d+$/.test(bvn), [bvn]);
  const ninValid = useMemo(() => nin.length === 11 && /^\d+$/.test(nin), [nin]);

  useEffect(() => {
    return () => {
      setBvn('');
      setNin('');
    };
  }, []);

  const handleVerify = async () => {
    setError(null);
    try {
      if (method === 'bvn') {
        await submitBvn.mutateAsync(bvn);
      } else if (method === 'nin') {
        await submitNin.mutateAsync(nin);
      }
      setBvn('');
      setNin('');
      setSuccess(true);
    } catch (e) {
      setError(sanitizeIdentityErrorMessage(getApiErrorMessage(e, 'Verification failed')));
    }
  };

  if (kycStatus?.status === 'VERIFIED') {
    return (
      <div className="space-y-4 px-4 pt-4">
        <div className="rounded-xl border border-green-800 bg-green-900/20 p-6 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-900 mb-4">
            <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2">KYC verified</h2>
          <p className="text-sm text-slate-400">Your account is fully verified and ready for investments.</p>
        </div>
      </div>
    );
  }
  if (success) {
    return (
      <div className="min-h-screen bg-dashboard-bg px-4 pt-4 pb-20">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/dashboard/account"
            className="p-2 rounded-lg hover:bg-dashboard-border/50 text-dashboard-heading"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-semibold text-dashboard-heading">Account verification</h1>
        </div>

        <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-6 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
            <ShieldCheck className="h-8 w-8 text-cohold-blue" />
          </div>
          <h2 className="text-lg font-semibold text-dashboard-heading mb-2">Verification submitted</h2>
          <p className="text-sm text-dashboard-body mb-4">We will review and get back to you.</p>

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-left text-sm text-amber-800 mb-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 border border-amber-200">
                <AlertCircle className="h-5 w-5 text-amber-800" />
              </div>
              <div>
                <div className="text-sm font-semibold text-amber-800 mb-1">Verification note</div>
                <div className="text-sm text-amber-800 leading-relaxed">
                  Verification takes maximum of 72 hours before a decision is reached. Stay calm, we are here for you.
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Link
              href="/dashboard/account"
              className="flex-1 rounded-xl border border-dashboard-border py-3 text-center text-sm font-medium text-dashboard-heading"
            >
              Back to Account
            </Link>
            <Link
              href="/dashboard/home"
              className="flex-1 rounded-xl bg-cohold-blue py-3 text-center text-sm font-medium text-white"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dashboard-bg pb-20">
      <div className="space-y-6 px-4 pt-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/account"
            className="p-2 rounded-lg hover:bg-dashboard-border/50 text-dashboard-heading"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-semibold text-dashboard-heading">Account verification</h1>
        </div>

        <p className="text-sm text-dashboard-body">
          Submit your BVN or NIN and required documents for compliance review.
        </p>

        <div className="rounded-xl border border-dashboard-border bg-dashboard-card p-4 text-sm">
          <p className="font-semibold text-dashboard-heading">Status</p>
          <p className="mt-1 text-dashboard-heading">{statusCopy(kycStatus?.status ?? 'UNKNOWN').title}</p>
          <p className="mt-1 text-dashboard-body">{statusCopy(kycStatus?.status ?? 'UNKNOWN').body}</p>
        </div>

        {/* Verification method */}
        <div className="relative">
          <label className="text-sm font-medium text-dashboard-heading block mb-2">Verification method</label>

          <button
            type="button"
            onClick={() => setIsMethodPickerOpen(true)}
            className="w-full rounded-xl border border-dashboard-border bg-white px-4 py-3 flex items-center justify-between"
            aria-haspopup="dialog"
            aria-expanded={isMethodPickerOpen}
          >
            <span className="text-sm font-medium text-dashboard-body">
              {method === 'bvn'
                ? 'Bank Verification Number (BVN)'
                : method === 'nin'
                  ? 'National Identification Number (NIN)'
                  : 'Select verification method'}
            </span>
            <ChevronDown className="h-5 w-5 text-dashboard-muted" />
          </button>

          {isMethodPickerOpen && (
            <div className="fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/10" onClick={() => setIsMethodPickerOpen(false)} />
              <div className="absolute top-24 right-4 w-[360px] rounded-2xl border border-dashboard-border bg-white shadow-[0_20px_40px_rgba(0,0,0,0.12)] overflow-hidden">
                <div className="px-5 py-4 flex items-start justify-between">
                  <div className="text-sm font-semibold text-dashboard-heading">Select verification</div>
                  <button
                    type="button"
                    onClick={() => setIsMethodPickerOpen(false)}
                    className="p-1 rounded-lg hover:bg-dashboard-border/40"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4 text-dashboard-body" />
                  </button>
                </div>

                <div className="px-5 pb-4 space-y-3">
                  <button type="button" className="w-full text-left flex items-center gap-3" onClick={() => setMethod('bvn')}>
                    <span
                      className={
                        'h-4 w-4 rounded-full border flex items-center justify-center flex-shrink-0 ' +
                        (method === 'bvn' ? 'border-cohold-blue bg-cohold-blue' : 'border-dashboard-border bg-white')
                      }
                    >
                      {method === 'bvn' && <span className="h-[7px] w-[7px] rounded-full bg-white" />}
                    </span>
                    <span className="text-sm font-medium text-dashboard-heading">Bank Verification Number (BVN)</span>
                  </button>

                  <button type="button" className="w-full text-left flex items-center gap-3" onClick={() => setMethod('nin')}>
                    <span
                      className={
                        'h-4 w-4 rounded-full border flex items-center justify-center flex-shrink-0 ' +
                        (method === 'nin' ? 'border-cohold-blue bg-cohold-blue' : 'border-dashboard-border bg-white')
                      }
                    >
                      {method === 'nin' && <span className="h-[7px] w-[7px] rounded-full bg-white" />}
                    </span>
                    <span className="text-sm font-medium text-dashboard-heading">National Identification Number (NIN)</span>
                  </button>
                </div>

                <div className="px-5 pb-5">
                  <button
                    type="button"
                    disabled={!method}
                    onClick={() => setIsMethodPickerOpen(false)}
                    className="w-full rounded-full bg-cohold-blue py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Select method
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input (conditional) */}
        {method === 'bvn' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-dashboard-heading block mb-2">Bank Verification Number (BVN)</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                maxLength={11}
                autoComplete="off"
                value={bvn}
                onChange={(e) => setBvn(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter BVN"
                className="w-full rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-dashboard-heading placeholder:text-dashboard-muted"
              />
              {bvnValid && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-100 border border-green-200 text-green-600">
                  <Check className="h-4 w-4" />
                </span>
              )}
            </div>
          </div>
        )}

        {method === 'nin' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-dashboard-heading block mb-2">National Identification Number (NIN)</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                maxLength={11}
                autoComplete="off"
                value={nin}
                onChange={(e) => setNin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter NIN"
                className="w-full rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-dashboard-heading placeholder:text-dashboard-muted"
              />
              {ninValid && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-100 border border-green-200 text-green-600">
                  <Check className="h-4 w-4" />
                </span>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4 rounded-xl border border-dashboard-border bg-dashboard-card p-4">
          <h2 className="text-sm font-semibold text-dashboard-heading">Identification documents</h2>
          <p className="text-xs text-dashboard-body">
            Upload clear photos or PDFs of your ID (front and back) and a selfie if required. Files go directly to secure storage.
          </p>
          <DocumentUploader
            label="ID — front"
            category="kycDocument"
            disabled={kycDocUpload.isPending}
            onFileSelected={async (file) => {
              await kycDocUpload.mutateAsync({ docType: 'ID_FRONT' as KycDocType, file });
            }}
          />
          <DocumentUploader
            label="ID — back"
            category="kycDocument"
            disabled={kycDocUpload.isPending}
            onFileSelected={async (file) => {
              await kycDocUpload.mutateAsync({ docType: 'ID_BACK' as KycDocType, file });
            }}
          />
          <DocumentUploader
            label="Selfie"
            category="kycDocument"
            disabled={kycDocUpload.isPending}
            onFileSelected={async (file) => {
              await kycDocUpload.mutateAsync({ docType: 'SELFIE' as KycDocType, file });
            }}
          />
          {kycDocUpload.isSuccess ? (
            <p className="text-xs text-green-700">Document uploaded. Verification remains pending until compliance review is completed.</p>
          ) : null}
        </div>

        <div className="rounded-xl border border-dashboard-border bg-dashboard-card p-4 text-xs text-dashboard-body">
          <p className="font-semibold text-dashboard-heading mb-1">Privacy and NDPR notice</p>
          <p>
            We request BVN/NIN for identity verification and regulatory compliance. Identity values are handled as sensitive data,
            processed securely, and not displayed in full after submission.
          </p>
          <p className="mt-1">
            Uploaded documents are private and reviewed by compliance teams. Review may be manual. For corrections or data requests, contact support.
          </p>
        </div>

        {/* Verification note */}
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 border border-amber-200">
              <AlertCircle className="h-5 w-5 text-amber-800" />
            </div>
            <div>
              <div className="text-sm font-semibold text-amber-800 mb-1">Verification note</div>
              <div className="text-sm text-amber-800 leading-relaxed">
                Verification takes maximum of 72 hours before a decision is reached. Stay calm, we are here for you.
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Verify account button */}
        <button
          type="button"
          onClick={handleVerify}
          disabled={
            !method ||
            (method === 'bvn' ? !bvnValid : !ninValid) ||
            submitBvn.isPending ||
            submitNin.isPending
          }
          className="w-full rounded-xl bg-cohold-blue py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitBvn.isPending || submitNin.isPending ? 'Submitting...' : 'Verify account'}
        </button>
      </div>
    </div>
  );
}
