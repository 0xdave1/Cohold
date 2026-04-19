import { assertClientUpload } from './upload-validation-client';
import { putFileToPresignedUrl, type PresignResponse } from './upload-file';

/**
 * POST to Next.js admin proxy (cookie session) and return typed `data` from backend envelope.
 */
async function adminProxyPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/admin/proxy/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof json?.error === 'string'
        ? json.error
        : typeof json?.message === 'string'
          ? json.message
          : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  const inner = json?.data !== undefined ? json.data : json;
  return inner as T;
}

export type PropertyImageComplete = {
  id: string;
  storageKey: string | null;
  altText: string | null;
  position: number;
  createdAt: string;
  url: string | null;
};

export type PropertyDocumentComplete = {
  id: string;
  type: string;
  s3Key: string;
  createdAt: string;
  url: string | null;
};

export async function adminUploadPropertyImage(
  propertyId: string,
  file: File,
  position: number,
  altText?: string,
): Promise<PropertyImageComplete> {
  assertClientUpload('propertyImage', file);

  const presign = await adminProxyPost<PresignResponse>(`admin/properties/${propertyId}/images/presign`, {
    fileName: file.name,
    contentType: file.type,
    fileSize: file.size,
    position,
  });

  await putFileToPresignedUrl(presign.uploadUrl, file);

  return adminProxyPost<PropertyImageComplete>(`admin/properties/${propertyId}/images/complete`, {
    key: presign.key,
    position,
    altText: altText?.trim() || undefined,
  });
}

export type PropertyDocType = 'TITLE' | 'SURVEY' | 'DEED' | 'OTHER';

export async function adminUploadPropertyDocument(
  propertyId: string,
  file: File,
  type: PropertyDocType,
): Promise<PropertyDocumentComplete> {
  assertClientUpload('propertyDocument', file);

  const presign = await adminProxyPost<PresignResponse>(`admin/properties/${propertyId}/documents/presign`, {
    type,
    fileName: file.name,
    contentType: file.type,
    fileSize: file.size,
  });

  await putFileToPresignedUrl(presign.uploadUrl, file);

  return adminProxyPost<PropertyDocumentComplete>(`admin/properties/${propertyId}/documents/complete`, {
    type,
    key: presign.key,
  });
}
