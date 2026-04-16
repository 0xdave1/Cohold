'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { PersonIcon } from '@/components/auth/AuthIcons';
import { auth } from '@/components/auth/auth-styles';
import { useMe, useOnboarding } from '@/lib/hooks/use-onboarding';
import { COUNTRIES } from '@/lib/constants/countries';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  nationality: z.string().min(1, 'Select your country'),
  phoneCountryCode: z.string().min(1, 'Required'),
  phoneNumber: z.string().min(8, 'Enter a valid phone number'),
});

type FormValues = z.infer<typeof schema>;

export default function PersonalDetailsPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { data: profile, isLoading: profileLoading } = useMe();
  const { updatePersonalDetails } = useOnboarding();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      nationality: 'Nigeria',
      phoneCountryCode: '+234',
      phoneNumber: '',
    },
  });

  // Watch nationality to auto-update country code
  const selectedNationality = form.watch('nationality');

  useEffect(() => {
    if (!profile) return;
    form.reset({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      nationality: profile.nationality ?? 'Nigeria',
      phoneCountryCode: profile.phoneCountryCode ?? '+234',
      phoneNumber: profile.phoneNumber ?? '',
    });
  }, [profile, form]);

  // Sync Country Code with Nationality selection
  useEffect(() => {
    const country = COUNTRIES.find((c) => c.name === selectedNationality);
    if (country) {
      form.setValue('phoneCountryCode', country.dialCode);
    }
  }, [selectedNationality, form]);

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await updatePersonalDetails.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        nationality: values.nationality,
        phoneCountryCode: values.phoneCountryCode,
        phoneNumber: values.phoneNumber.replace(/\s/g, ''),
      });
      router.push('/onboarding/residential-details');
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
      <p className={auth.pageTitle}>personal details</p>
      <div className="mt-6">
        <PersonIcon className="mb-4" />
        <h1 className={auth.heading}>Personal details</h1>
        <p className={"mt-2 " + auth.body}>
          Provide your details to give you a personalized experience on Cohold
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        {/* First Name */}
        <div className="space-y-1.5">
          <label className={auth.label}>First name</label>
          <input placeholder="Joe" className={auth.input} {...form.register('firstName')} />
          {form.formState.errors.firstName && <p className={auth.error}>{form.formState.errors.firstName.message}</p>}
        </div>

        {/* Last Name */}
        <div className="space-y-1.5">
          <label className={auth.label}>Last name</label>
          <input placeholder="Doe" className={auth.input} {...form.register('lastName')} />
          {form.formState.errors.lastName && <p className={auth.error}>{form.formState.errors.lastName.message}</p>}
        </div>

        {/* Nationality */}
        <div className="space-y-1.5">
          <label className={auth.label}>Nationality</label>
          <select 
            className={auth.input + " appearance-none bg-no-repeat bg-[length:16px] bg-[right_12px_center]"} 
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\")" }} 
            {...form.register('nationality')}
          >
            <option value="">Select country</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.name}>{c.name}</option>
            ))}
          </select>
          {form.formState.errors.nationality && <p className={auth.error}>{form.formState.errors.nationality.message}</p>}
        </div>

        {/* Phone Number - FIX APPLIED HERE */}
        <div className="space-y-1.5">
          <label className={auth.label}>Phone number</label>
           <div className="flex gap-2">
            <select
              className={auth.input + " !w-24 flex-none px-2 appearance-none"}
              {...form.register('phoneCountryCode')}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.dialCode}>
                  {c.dialCode}
                </option>
              ))}
            </select>

            <input
              type="tel"
              placeholder="812 345 6789"
              className={auth.input + " !w-auto flex-1 min-w-0"}
              {...form.register('phoneNumber')}
            />
          </div>
          {form.formState.errors.phoneNumber && <p className={auth.error}>{form.formState.errors.phoneNumber.message}</p>}
        </div>

        {error && <div className={auth.errorBox}>{error}</div>}

        <button type="submit" disabled={updatePersonalDetails.isPending} className={auth.btnPrimary}>
          {updatePersonalDetails.isPending ? 'Saving...' : 'Proceed'}
        </button>
      </form>
    </main>
  );
}