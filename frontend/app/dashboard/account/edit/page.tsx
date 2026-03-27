'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMe, useOnboarding } from '@/lib/hooks/use-onboarding';
import { COUNTRIES } from '@/lib/constants/countries';
import { getApiErrorMessage } from '@/lib/api/errors';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  nationality: z.string().min(1, 'Select country'),
  phoneCountryCode: z.string().min(1, 'Required'),
  phoneNumber: z.string().min(8, 'Valid phone required'),
  houseNumber: z.string().optional(),
  streetName: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function getInitials(first?: string | null, last?: string | null) {
  return [first?.[0], last?.[0]].filter(Boolean).join('').toUpperCase() || 'U';
}

export default function EditProfilePage() {
  const { data: me, isLoading } = useMe();
  const { updateProfile } = useOnboarding();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      nationality: 'Nigeria',
      phoneCountryCode: '+234',
      phoneNumber: '',
      houseNumber: '',
      streetName: '',
    },
  });

  useEffect(() => {
    if (!me) return;
    form.reset({
      firstName: me.firstName ?? '',
      lastName: me.lastName ?? '',
      nationality: me.nationality ?? 'Nigeria',
      phoneCountryCode: me.phoneCountryCode ?? '+234',
      phoneNumber: me.phoneNumber ?? '',
      houseNumber: me.houseNumber ?? '',
      streetName: me.streetName ?? '',
    });
  }, [me, form]);

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await updateProfile.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        nationality: values.nationality,
        phoneCountryCode: values.phoneCountryCode,
        phoneNumber: values.phoneNumber.replace(/\s/g, ''),
        houseNumber: values.houseNumber || undefined,
        streetName: values.streetName || undefined,
      });
      form.reset(values);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to save'));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dashboard-bg px-4 pt-4">
        <p className="text-dashboard-body">Loading...</p>
      </div>
    );
  }

  const initials = getInitials(me?.firstName, me?.lastName);

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
          <h1 className="text-xl font-semibold text-dashboard-heading">Edit profile</h1>
        </div>
        <p className="text-sm text-dashboard-body">Make edits to your profile</p>

        <div className="flex flex-col items-center gap-2">
          <div className="h-20 w-20 rounded-full bg-cohold-icon-bg flex items-center justify-center text-2xl font-semibold text-dashboard-heading">
            {initials}
          </div>
          <button type="button" className="text-sm font-medium text-cohold-blue hover:underline">
            Edit photo
          </button>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-dashboard-heading block mb-1">First name</label>
            <input
              {...form.register('firstName')}
              className="w-full rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-dashboard-heading"
            />
            {form.formState.errors.firstName && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.firstName.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-dashboard-heading block mb-1">Last name</label>
            <input
              {...form.register('lastName')}
              className="w-full rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-dashboard-heading"
            />
            {form.formState.errors.lastName && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.lastName.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-dashboard-heading block mb-1">Nationality</label>
            <select
              {...form.register('nationality')}
              className="w-full rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-dashboard-heading"
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.name}>{c.name}</option>
              ))}
            </select>
            {form.formState.errors.nationality && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.nationality.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-dashboard-heading block mb-1">Phone number</label>
            <div className="flex gap-2">
              <select
                {...form.register('phoneCountryCode')}
                className="w-24 rounded-xl border border-dashboard-border bg-dashboard-card px-2 py-2.5 text-dashboard-heading"
              >
                <option value="+234">+234</option>
                <option value="+44">+44</option>
                <option value="+1">+1</option>
              </select>
              <input
                {...form.register('phoneNumber')}
                placeholder="701 234 XXXX"
                className="flex-1 rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-dashboard-heading placeholder:text-dashboard-muted"
              />
            </div>
            {form.formState.errors.phoneNumber && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.phoneNumber.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-dashboard-heading block mb-1">House number</label>
            <input
              {...form.register('houseNumber')}
              placeholder="e.g. 10"
              className="w-full rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-dashboard-heading placeholder:text-dashboard-muted"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-dashboard-heading block mb-1">Street name</label>
            <input
              {...form.register('streetName')}
              placeholder="Street name"
              className="w-full rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-dashboard-heading placeholder:text-dashboard-muted"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={updateProfile.isPending}
            className="w-full rounded-xl bg-cohold-blue py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {updateProfile.isPending ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
