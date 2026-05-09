'use client';

import { useEffect, useState } from 'react';

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  minLength?: number;
  maxLength?: number;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
};

export function AdminReasonDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  minLength = 5,
  maxLength = 500,
  onClose,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    const t = reason.trim();
    if (t.length < minLength) {
      setError(`Reason must be at least ${minLength} characters.`);
      return;
    }
    if (t.length > maxLength) {
      setError(`Reason must be at most ${maxLength} characters.`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onConfirm(t);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {description ? <p className="mt-2 text-sm text-gray-600">{description}</p> : null}
        <label className="mt-4 block text-xs font-medium text-gray-700">Reason</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#1a3a4a] focus:ring-1 focus:ring-[#1a3a4a]"
          placeholder="Explain why this action is appropriate (visible to auditors on supported endpoints)."
        />
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="rounded-lg bg-[#1a3a4a] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
