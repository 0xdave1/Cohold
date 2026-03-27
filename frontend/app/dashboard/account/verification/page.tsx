'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSubmitBvn, useSubmitNin } from '@/lib/hooks/use-kyc';
import { getApiErrorMessage } from '@/lib/api/errors';
import { AlertCircle, Check, ChevronDown, ShieldCheck, X } from 'lucide-react';

type Method = 'bvn' | 'nin' | null;

export default function AccountVerificationPage() {
  const [method, setMethod] = useState<Method>(null);
  const [bvn, setBvn] = useState('');
  const [nin, setNin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isMethodPickerOpen, setIsMethodPickerOpen] = useState(false);

  const submitBvn = useSubmitBvn();
  const submitNin = useSubmitNin();

  const bvnValid = bvn.length === 11 && /^\d+$/.test(bvn);
  const ninValid = nin.length === 11 && /^\d+$/.test(nin);

  const handleVerify = async () => {
    setError(null);
    try {
      if (method === 'bvn') {
        if (!bvnValid) { setError('BVN must be 11 digits'); return; }
        await submitBvn.mutateAsync(bvn);
      } else if (method === 'nin') {
        if (!ninValid) { setError('NIN must be 11 digits'); return; }
        await submitNin.mutateAsync(nin);
      }
      setSuccess(true);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Verification failed'));
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-dashboard-bg px-4 pt-4 pb-20">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard/account" className="p-2 rounded-lg hover:bg-dashboard-border/50 text-dashboard-heading" aria-label="Back">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
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
            <Link href="/dashboard/account" className="flex-1 rounded-xl border border-dashboard-border py-3 text-center text-sm font-medium text-dashboard-heading">Back to Account</Link>
            <Link href="/dashboard/home" className="flex-1 rounded-xl bg-cohold-blue py-3 text-center text-sm font-medium text-white">Go to Home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dashboard-bg pb-20">
      <div className="space-y-6 px-4 pt-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/account" className="p-2 rounded-lg hover:bg-dashboard-border/50 text-dashboard-heading" aria-label="Back">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-xl font-semibold text-dashboard-heading">Account verification</h1>
        </div>
        <p className="text-sm text-dashboard-body">
          We&apos;ll verify your account through BVN or NIN for KYC verification
        </p>

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
              {method === 'bvn' ? 'Bank Verification Number (BVN)' : method === 'nin' ? 'National Identification Number (NIN)' : 'Select a verification method'}
            </span>
            <ChevronDown className="h-5 w-5 text-dashboard-muted" />
          </button>

          {isMethodPickerOpen && (
            <div className="fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/10" onClick={() => setIsMethodPickerOpen(false)} />
              <div className="absolute top-24 right-4 w-[320px] rounded-2xl border border-dashboard-border bg-white shadow-[0_20px_40px_rgba(0,0,0,0.12)] overflow-hidden">
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
                  <button
                    type="button"
                    onClick={() => setMethod('bvn')}
                    className="w-full text-left flex items-center gap-3"
                  >
                    <span className={
                      'h-4 w-4 rounded-full border flex items-center justify-center flex-shrink-0 ' +
                      (method === 'bvn' ? 'border-cohold-blue bg-cohold-blue' : 'border-dashboard-border bg-white')
                    }>
                      {method === 'bvn' && <span className="h-[7px] w-[7px] rounded-full bg-white" />}
                    </span>
                    <span className="text-sm font-medium text-dashboard-heading">Bank Verification Number (BVN)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethod('nin')}
                    className="w-full text-left flex items-center gap-3"
                  >
                    <span className={
                      'h-4 w-4 rounded-full border flex items-center justify-center flex-shrink-0 ' +
                      (method === 'nin' ? 'border-cohold-blue bg-cohold-blue' : 'border-dashboard-border bg-white')
                    }>
                      {method === 'nin' && <span className="h-[7px] w-[7px] rounded-full bg-white" />}
                    </span>
                    <span className="text-sm font-medium text-dashboard-heading">National Identification Number (NIN)</span>
                  </button>
                </div>

                <div className="px-5 pb-4">
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

        {/* Inputs: keep both visible (as in the Figma) and only show green validation for the selected method */}
        {method && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-dashboard-heading block mb-2">
                Bank Verification Number (BVN)
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={11}
                  value={bvn}
                  disabled={method !== 'bvn'}
                  onChange={(e) => setBvn(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter BVN"
                  className={
                    'w-full rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-dashboard-heading placeholder:text-dashboard-muted ' +
                    (method !== 'bvn' ? 'opacity-60 cursor-not-allowed' : '')
                  }
                />
                {method === 'bvn' && bvnValid && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-100 border border-green-200 text-green-600">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-dashboard-heading block mb-2">
                National Identification Number (NIN)
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={11}
                  value={nin}
                  disabled={method !== 'nin'}
                  onChange={(e) => setNin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter NIN"
                  className={
                    'w-full rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-dashboard-heading placeholder:text-dashboard-muted ' +
                    (method !== 'nin' ? 'opacity-60 cursor-not-allowed' : '')
                  }
                />
                {method === 'nin' && ninValid && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-100 border border-green-200 text-green-600">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 border border-amber-200">
              <AlertCircle className="h-5 w-5 text-amber-800" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-amber-800 mb-1">Verification note</div>
              <div className="text-sm text-amber-800 leading-relaxed">
                Verification takes maximum of 72 hours before a decision is reached. Stay calm, we are here for you.
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
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
