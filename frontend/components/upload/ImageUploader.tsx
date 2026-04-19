'use client';

import { useId, useState } from 'react';
import Image from 'next/image';
import { Upload, X } from 'lucide-react';
import { clientUploadHint } from '@/lib/uploads/upload-validation-client';

export type ImageUploaderProps = {
  label: string;
  /** Called with chosen image file; parent runs presign + PUT + complete */
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
};

/**
 * Single image picker for property (or similar) flows — parent owns API calls.
 */
export function ImageUploader({ label, onUpload, disabled }: ImageUploaderProps) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setBusy(true);
    const url = URL.createObjectURL(file);
    setPreview(url);
    try {
      await onUpload(file);
    } catch (err) {
      setPreview(null);
      URL.revokeObjectURL(url);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      {preview ? (
        <div className="relative inline-block">
          <Image
            src={preview}
            alt=""
            width={256}
            height={160}
            unoptimized
            className="h-40 w-64 rounded-lg object-cover"
          />
          <button
            type="button"
            onClick={() => {
              setPreview(null);
            }}
            className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
            aria-label="Remove preview"
          >
            <X className="h-3 w-3" />
          </button>
          {busy ? (
            <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 text-sm text-white">
              Uploading…
            </span>
          ) : null}
        </div>
      ) : (
        <label
          htmlFor={id}
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 px-6 py-10 transition-colors hover:border-gray-400 ${disabled || busy ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <Upload className="h-6 w-6 text-gray-400" />
          <p className="text-sm text-gray-400">{busy ? 'Working…' : 'Upload image'}</p>
          <p className="text-[11px] text-gray-400">{clientUploadHint('propertyImage')}</p>
          <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={disabled || busy} onChange={onChange} />
        </label>
      )}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
