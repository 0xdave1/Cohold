'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAddLinkedBank } from '@/lib/hooks/use-linked-banks';
import { getApiErrorMessage } from '@/lib/api/errors';
import { Building2 } from 'lucide-react';

const schema = z.object({
  currency: z.enum(['NGN', 'USD', 'GBP', 'EUR']),
  accountNumber: z.string().min(10, 'Valid account number required').max(12),
  bankName: z.string().min(2, 'Bank name required'),
  accountName: z.string().min(2, 'Account name required'),
});

type FormValues = z.infer<typeof schema>;

const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR'] as const;

export default function AddLinkedBankPage() {
  const addBank = useAddLinkedBank();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'NGN', accountNumber: '', bankName: '', accountName: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await addBank.mutateAsync({
        currency: values.currency,
        accountNumber: values.accountNumber.trim(),
        bankName: values.bankName.trim(),
        accountName: values.accountName.trim(),
      });
      form.reset();
      window.location.href = '/dashboard/account/linked-banks';
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to add bank'));
    }
  };

  return (
    <div className="min-h-screen bg-dashboard-bg pb-20">
      <div className="space-y-6 px-4 pt-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/account/linked-banks" className="p-2 rounded-lg hover:bg-dashboard-border/50 text-dashboard-heading" aria-label="Back">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-xl font-semibold text-dashboard-heading">Add a bank</h1>
        </div>
        <p className="text-sm text-dashboard-body">Link a bank account for withdrawals.</p>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-dashboard-heading block mb-1">Currency</label>
            <select {...form.register('currency')} className="w-full rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-dashboard-heading">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-dashboard-heading block mb-1">Bank name</label>
            <input {...form.register('bankName')} placeholder="e.g. First Bank" className="w-full rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-dashboard-heading placeholder:text-dashboard-muted" />
            {form.formState.errors.bankName && <p className="text-xs text-red-600 mt-1">{form.formState.errors.bankName.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-dashboard-heading block mb-1">Account number</label>
            <input {...form.register('accountNumber')} type="text" inputMode="numeric" placeholder="10 digits" className="w-full rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-dashboard-heading placeholder:text-dashboard-muted" />
            {form.formState.errors.accountNumber && <p className="text-xs text-red-600 mt-1">{form.formState.errors.accountNumber.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-dashboard-heading block mb-1">Account name</label>
            <input {...form.register('accountName')} placeholder="Name on account" className="w-full rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-dashboard-heading placeholder:text-dashboard-muted" />
            {form.formState.errors.accountName && <p className="text-xs text-red-600 mt-1">{form.formState.errors.accountName.message}</p>}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={addBank.isPending} className="w-full rounded-xl bg-cohold-blue py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            <Building2 className="h-4 w-4" /> {addBank.isPending ? 'Adding...' : 'Add bank'}
          </button>
        </form>
      </div>
    </div>
  );
}
