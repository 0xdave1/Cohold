'use client';

import { useEffect, useRef } from 'react';
import { MoreVertical } from 'lucide-react';

type ActionMenuProps = {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onView: () => void;
  onEdit: () => void;
  onSuspend: () => void;
  onDeactivate: () => void;
};

export function AdminActionMenu({
  open,
  onToggle,
  onClose,
  onView,
  onEdit,
  onSuspend,
  onDeactivate,
}: ActionMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const t = window.setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open, onClose]);

  return (
    <div className="relative flex justify-end" ref={rootRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="rounded-lg p-2 text-[#6B7280] transition hover:bg-[#F3F4F6]"
        aria-label="Open admin actions"
        aria-expanded={open}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-xl border border-[#E5E7EB] bg-white py-1.5 shadow-lg">
          <button
            type="button"
            onClick={() => {
              onView();
              onClose();
            }}
            className="block w-full px-4 py-2.5 text-left text-sm text-[#374151] hover:bg-[#F9FAFB]"
          >
            View details
          </button>
          <button
            type="button"
            onClick={() => {
              onEdit();
              onClose();
            }}
            className="block w-full px-4 py-2.5 text-left text-sm text-[#374151] hover:bg-[#F9FAFB]"
          >
            Edit admin
          </button>
          <button
            type="button"
            onClick={() => {
              onSuspend();
              onClose();
            }}
            className="block w-full px-4 py-2.5 text-left text-sm text-[#374151] hover:bg-[#F9FAFB]"
          >
            Suspend admin
          </button>
          <button
            type="button"
            onClick={() => {
              onDeactivate();
              onClose();
            }}
            className="block w-full px-4 py-2.5 text-left text-sm text-[#DC2626] hover:bg-[#FEF2F2]"
          >
            Deactivate admin
          </button>
        </div>
      ) : null}
    </div>
  );
}
