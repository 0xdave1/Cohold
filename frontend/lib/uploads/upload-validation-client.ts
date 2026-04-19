/** Client-side checks before calling presign (mirrors backend `upload-validation.ts`). */

export type UploadCategory = 'profilePhoto' | 'kycDocument' | 'propertyImage' | 'propertyDocument';

const RULES: Record<
  UploadCategory,
  { allowedContentTypes: string[]; maxBytes: number; label: string }
> = {
  profilePhoto: {
    allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 3 * 1024 * 1024,
    label: 'JPEG, PNG, or WebP up to 3MB',
  },
  kycDocument: {
    allowedContentTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxBytes: 10 * 1024 * 1024,
    label: 'JPEG, PNG, or PDF up to 10MB',
  },
  propertyImage: {
    allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 5 * 1024 * 1024,
    label: 'JPEG, PNG, or WebP up to 5MB',
  },
  propertyDocument: {
    allowedContentTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    maxBytes: 15 * 1024 * 1024,
    label: 'PDF or images up to 15MB',
  },
};

export function assertClientUpload(category: UploadCategory, file: File): void {
  const rules = RULES[category];
  if (!rules.allowedContentTypes.includes(file.type)) {
    throw new Error(`Invalid file type. Use ${rules.label}.`);
  }
  if (file.size <= 0 || file.size > rules.maxBytes) {
    throw new Error(`File size must be between 1 byte and ${Math.round(rules.maxBytes / (1024 * 1024))}MB.`);
  }
}

export function clientUploadHint(category: UploadCategory): string {
  return RULES[category].label;
}
