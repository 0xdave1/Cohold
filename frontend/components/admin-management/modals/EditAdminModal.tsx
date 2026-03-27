'use client';

import { useEffect, useState } from 'react';
import type { AdminUser } from '@/lib/admin/types';
import type { UiAdminRole } from '@/components/admin-management/constants';
import { ROLE_OPTIONS, normalizeRole, displayAdminName } from '@/components/admin-management/constants';
import { FormField } from '@/components/admin-management/FormField';
import { BaseModal } from './BaseModal';

type EditAdminModalProps = {
  open: boolean;
  admin: AdminUser | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (
    id: string,
    payload: { fullName?: string; email?: string; phoneNumber?: string; role?: UiAdminRole },
  ) => Promise<void>;
};

export function EditAdminModal({ open, admin, loading = false, onClose, onSubmit }: EditAdminModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState<UiAdminRole>('OPERATION_ADMIN');

  useEffect(() => {
    if (!admin) return;
    setFullName(admin.fullName?.trim() ? admin.fullName : displayAdminName(admin));
    setEmail(admin.email);
    setPhoneNumber(admin.phoneNumber ?? '');
    setRole(normalizeRole(admin.role));
  }, [admin]);

  const submit = async () => {
    if (!admin) return;
    await onSubmit(admin.id, { fullName, email, phoneNumber, role });
  };

  return (
    <BaseModal open={open} title="Edit admin" onClose={onClose}>
      <div className="space-y-4">
        <FormField label="Full name">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alade Sam"
            className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#1a3a4a] focus:outline-none focus:ring-2 focus:ring-[#1a3a4a]/15"
          />
        </FormField>
        <FormField label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="mail@example.com"
            className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#1a3a4a] focus:outline-none focus:ring-2 focus:ring-[#1a3a4a]/15"
          />
        </FormField>
        <FormField label="Phone number">
          <input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="0800 000 0000"
            className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#1a3a4a] focus:outline-none focus:ring-2 focus:ring-[#1a3a4a]/15"
          />
        </FormField>
        <FormField label="Role">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UiAdminRole)}
            className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#111827] focus:border-[#1a3a4a] focus:outline-none focus:ring-2 focus:ring-[#1a3a4a]/15"
          >
            {ROLE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-[#F3F4F6] py-2.5 text-sm font-semibold text-[#374151] transition hover:bg-[#E5E7EB]"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={loading || !email.trim() || !fullName.trim()}
          onClick={submit}
          className="rounded-full bg-[#00416A] py-2.5 text-sm font-semibold text-white transition hover:bg-[#003558] disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </BaseModal>
  );
}
