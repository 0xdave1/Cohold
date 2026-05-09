/**
 * Client-side hints aligned with backend upload rules (not a security boundary).
 * Backend `upload-validation` / KYC controller limits remain authoritative.
 */
export const KYC_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const KYC_DOCUMENT_ACCEPT = ['image/jpeg', 'image/png', 'application/pdf'] as const;

export const SUPPORT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export type UploadRejectionReason = 'too_large' | 'bad_type';

export function validateKycFileBeforeUpload(file: File): UploadRejectionReason | null {
  if (!KYC_DOCUMENT_ACCEPT.includes(file.type as (typeof KYC_DOCUMENT_ACCEPT)[number])) {
    return 'bad_type';
  }
  if (file.size > KYC_DOCUMENT_MAX_BYTES) {
    return 'too_large';
  }
  return null;
}

export function uploadRejectionMessage(reason: UploadRejectionReason): string {
  if (reason === 'too_large') {
    return `This file is too large. Maximum size is ${Math.round(KYC_DOCUMENT_MAX_BYTES / (1024 * 1024))} MB.`;
  }
  return 'Only JPEG, PNG, or PDF files are allowed for this upload.';
}
