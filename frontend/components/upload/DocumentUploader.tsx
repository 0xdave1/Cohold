'use client';

import { useId, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { clientUploadHint, type UploadCategory } from '@/lib/uploads/upload-validation-client';

export type DocumentUploaderProps = {
  label: string;
  category: UploadCategory;
  disabled?: boolean;
  onFileSelected: (file: File) => Promise<void>;
  /** Shown under the dropzone */
  hint?: string;
};

export function DocumentUploader({ label, category, disabled, onFileSelected, hint }: DocumentUploaderProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept =
    category === 'kycDocument' || category === 'propertyDocument'
      ? 'image/jpeg,image/png,application/pdf'
      : 'image/jpeg,image/png,image/webp';

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      await onFileSelected(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-dashboard-heading">{label}</p>
      <label
        htmlFor={id}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-dashboard-border bg-white px-4 py-6 transition-colors hover:border-cohold-blue/50 ${disabled || busy ? 'pointer-events-none opacity-60' : ''}`}
      >
        <Upload className="h-6 w-6 text-dashboard-body" />
        <span className="text-sm text-dashboard-body">
          {busy ? 'Uploading…' : <span className="font-medium text-cohold-blue">Tap to upload</span>}
        </span>
        <span className="text-[11px] text-dashboard-muted">{hint ?? clientUploadHint(category)}</span>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled || busy}
          onChange={onChange}
        />
      </label>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
