'use client';

import { User } from 'lucide-react';
import { BaseModal } from './BaseModal';

type SuspendAdminModalProps = {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function SuspendAdminModal({ open, loading = false, onClose, onConfirm }: SuspendAdminModalProps) {
  return (
    <BaseModal open={open} title="Suspend admin" onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F9FAFB]">
          <User className="h-6 w-6 text-[#6B7280]" />
        </div>
        <p className="text-sm leading-relaxed text-[#4B5563]">
          Are you sure you want to suspend this admin?
        </p>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={onConfirm}
          className="rounded-full bg-[#F3F4F6] py-2.5 text-sm font-semibold text-[#374151] transition hover:bg-[#E5E7EB] disabled:opacity-50"
        >
          {loading ? 'Suspending…' : 'Yes, suspend'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-[#00416A] py-2.5 text-sm font-semibold text-white transition hover:bg-[#003558]"
        >
          No, cancel
        </button>
      </div>
    </BaseModal>
  );
}
