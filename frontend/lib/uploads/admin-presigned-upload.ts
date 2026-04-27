import { assertClientUpload } from './upload-validation-client';
import { putFileToPresignedUrl } from './upload-file';
import { adminApi } from '@/lib/admin/api';

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

  const presign = await adminApi.presignPropertyImage(propertyId, {
    fileName: file.name,
    contentType: file.type,
    fileSize: file.size,
    position,
  });

  await putFileToPresignedUrl(presign.uploadUrl, file);

  return adminApi.completePropertyImage(propertyId, {
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

  const presign = await adminApi.presignPropertyDocument(propertyId, {
    type,
    fileName: file.name,
    contentType: file.type,
    fileSize: file.size,
  });

  await putFileToPresignedUrl(presign.uploadUrl, file);

  return adminApi.completePropertyDocument(propertyId, {
    type,
    key: presign.key,
  });
}
