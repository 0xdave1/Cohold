'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { HouseIcon } from '@/components/auth/AuthIcons';
import { auth } from '@/components/auth/auth-styles';
import { useMe, useOnboarding } from '@/lib/hooks/use-onboarding';
import { NIGERIAN_STATES } from '@/lib/constants/countries';

const schema = z.object({
  houseNumber: z.string().min(1, 'House number is required'),
  streetName: z.string().min(1, 'Street name is required'),
  city: z.string().min(1, 'City/Town is required'),
  state: z.string().min(1, 'Select a state'),
});

type FormValues = z.infer<typeof schema>;

export default function ResidentialDetailsPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { data: profile, isLoading: profileLoading } = useMe();
  const { updateResidentialDetails } = useOnboarding();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { houseNumber: '', streetName: '', city: '', state: '' },
  });

  useEffect(() => {
    if (!profile) return;
    form.reset({
      houseNumber: profile.houseNumber ?? '',
      streetName: profile.streetName ?? '',
      city: profile.city ?? '',
      state: profile.state ?? '',
    });
  }, [profile, form]);

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await updateResidentialDetails.mutateAsync({
        houseNumber: values.houseNumber,
        streetName: values.streetName,
        city: values.city,
        state: values.state,
      });
      router.push('/onboarding/review');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save. Please try again.');
    }
  };

  if (profileLoading) {
    return (
      <div className={auth.card}>
        <p className="text-auth-body">Loading...</p>
      </div>
    );
  }

  return (
    <main className={auth.card}>
      <p className={auth.pageTitle}>residential details</p>
      <div className="mt-6">
        <HouseIcon className="mb-4" />
        <h1 className={auth.heading}>Residential details</h1>
        <p className={'mt-2 ' + auth.body}>
          Provide details of your residential address to help us understand you better
        </p>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        <div className="space-y-1.5">
          <label className={auth.label}>House number</label>
          <input placeholder="e.g. 10" className={auth.input} {...form.register('houseNumber')} />
          {form.formState.errors.houseNumber && <p className={auth.error}>{form.formState.errors.houseNumber.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label className={auth.label}>Street name</label>
          <input placeholder="e.g. Ajokele Ajayi Street" className={auth.input} {...form.register('streetName')} />
          {form.formState.errors.streetName && <p className={auth.error}>{form.formState.errors.streetName.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label className={auth.label}>City/Town</label>
          <input placeholder="e.g. Abuja" className={auth.input} {...form.register('city')} />
          {form.formState.errors.city && <p className={auth.error}>{form.formState.errors.city.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label className={auth.label}>State</label>
          <select
            className={auth.input + ' appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat'}
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236b7280\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")' }}
            {...form.register('state')}
          >
            <option value="">Select a state</option>
            {NIGERIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {form.formState.errors.state && <p className={auth.error}>{form.formState.errors.state.message}</p>}
        </div>
        {error && <div className={auth.errorBox}>{error}</div>}
        <button type="submit" disabled={updateResidentialDetails.isPending} className={auth.btnPrimary}>
          {updateResidentialDetails.isPending ? 'Saving...' : 'Proceed'}
        </button>
      </form>
    </main>
  );
}
