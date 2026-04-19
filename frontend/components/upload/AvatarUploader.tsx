'use client';

import { useCallback, useId, useRef, useState } from 'react';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import { uploadProfilePhoto } from '@/lib/uploads/upload-file';
import { clientUploadHint } from '@/lib/uploads/upload-validation-client';

export type AvatarUploaderProps = {
  /** Initials fallback when no photo */
  initials: string;
  /** Signed read URL from GET /users/me */
  photoUrl?: string | null;
  /** Optional class on the round wrapper */
  className?: string;
  /** Size in pixels (tailwind h/w derived) */
  size?: 'md' | 'lg';
};

const SIZE_CLASS = { md: 'h-20 w-20 text-2xl', lg: 'h-24 w-24 text-3xl' };

export function AvatarUploader({ initials, photoUrl, className = '', size = 'md' }: AvatarUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setError(null);
      setUploading(true);
      try {
        await uploadProfilePhoto(file);
        await qc.invalidateQueries({ queryKey: ['users', 'me'] });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [qc],
  );

  const sizeCls = SIZE_CLASS[size];

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={`relative rounded-full bg-cohold-icon-bg flex items-center justify-center font-semibold text-dashboard-heading overflow-hidden ring-offset-2 focus:outline-none focus:ring-2 focus:ring-cohold-blue disabled:opacity-60 ${sizeCls}`}
        aria-label="Change profile photo"
      >
        {photoUrl ? (
          <Image src={photoUrl} alt="" fill className="object-cover" sizes="96px" unoptimized />
        ) : (
          <span>{initials}</span>
        )}
        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">…</span>
        ) : null}
      </button>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={onPick}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-sm font-medium text-cohold-blue hover:underline disabled:opacity-50"
      >
        {uploading ? 'Uploading…' : 'Edit photo'}
      </button>
      <p className="text-[11px] text-dashboard-body/80 text-center max-w-[220px]">{clientUploadHint('profilePhoto')}</p>
      {error ? <p className="text-xs text-red-600 text-center">{error}</p> : null}
    </div>
  );
}
