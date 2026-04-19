import { apiClient } from '@/lib/api/client';
import type { UserProfile } from '@/lib/hooks/use-onboarding';
import { assertClientUpload } from './upload-validation-client';

export type PresignResponse = {
  key: string;
  uploadUrl: string;
  expiresIn: number;
};

/**
 * PUT file bytes to R2/S3 using a presigned URL (no traffic through Cohold API).
 */
export async function putFileToPresignedUrl(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Upload failed (${res.status})`);
  }
}

export type UploadFileOptions = {
  presignPath: string;
  completePath: string;
  file: File;
  presignBody: Record<string, unknown>;
  /** Build complete payload; always receives the object key from presign. */
  buildCompleteBody: (key: string) => Record<string, unknown>;
  validate?: (file: File) => void;
};

/**
 * Generic presign → PUT → complete flow for user JWT routes (`apiClient`).
 */
export async function uploadFile<TComplete>(opts: UploadFileOptions): Promise<TComplete> {
  opts.validate?.(opts.file);

  const presign = await apiClient.post<PresignResponse>(opts.presignPath, opts.presignBody);
  if (!presign.success || !presign.data) {
    throw new Error(presign.error ?? 'Could not start upload');
  }

  const { key, uploadUrl } = presign.data;
  await putFileToPresignedUrl(uploadUrl, opts.file);

  const complete = await apiClient.post<TComplete>(opts.completePath, opts.buildCompleteBody(key));
  if (!complete.success || complete.data === undefined) {
    throw new Error(complete.error ?? 'Could not finalize upload');
  }
  return complete.data;
}

export async function uploadProfilePhoto(file: File): Promise<UserProfile> {
  return uploadFile<UserProfile>({
    presignPath: '/users/me/profile-photo/presign',
    completePath: '/users/me/profile-photo/complete',
    file,
    presignBody: {
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
    },
    buildCompleteBody: (key) => ({ key }),
    validate: (f) => assertClientUpload('profilePhoto', f),
  });
}

export type KycDocType = 'ID_FRONT' | 'ID_BACK' | 'SELFIE';

export async function uploadKycDocument(file: File, docType: KycDocType): Promise<{ status: string }> {
  return uploadFile<{ status: string }>({
    presignPath: '/kyc/uploads/presign',
    completePath: '/kyc/uploads/complete',
    file,
    presignBody: {
      docType,
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
    },
    buildCompleteBody: (key) => ({ docType, key }),
    validate: (f) => assertClientUpload('kycDocument', f),
  });
}
