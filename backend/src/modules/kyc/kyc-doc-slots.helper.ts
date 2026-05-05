import type { Prisma } from '@prisma/client';

export type KycSlotKey = 'ID_FRONT' | 'ID_BACK' | 'SELFIE';

export type KycDocumentSlotStatus =
  | 'PENDING_PUT'
  | 'UPLOADED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'QUARANTINED';

export interface KycDocumentSlotState {
  storageKey: string;
  bucket?: string;
  expectedContentType?: string;
  expectedMaxBytes?: number;
  presignedIssuedAt?: string;
  contentType?: string;
  sizeBytes?: number;
  etag?: string;
  uploadedAt?: string;
  lastModified?: string;
  status: KycDocumentSlotStatus;
  malwareScanStatus?: 'NOT_CONFIGURED' | 'PENDING' | 'CLEAN';
}

export function parseDocumentSlots(
  raw: Prisma.JsonValue | null | undefined,
): Partial<Record<KycSlotKey, KycDocumentSlotState>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Partial<Record<KycSlotKey, KycDocumentSlotState>>;
}

export function legacyDocKeyField(
  slot: KycSlotKey,
): 'documentFrontKey' | 'documentBackKey' | 'selfieKey' {
  if (slot === 'ID_FRONT') return 'documentFrontKey';
  if (slot === 'ID_BACK') return 'documentBackKey';
  return 'selfieKey';
}

export const KYC_SLOT_ORDER: KycSlotKey[] = ['ID_FRONT', 'ID_BACK', 'SELFIE'];

export function hasAllRequiredSlotsUploaded(
  slots: Partial<Record<KycSlotKey, KycDocumentSlotState>>,
  kyc: {
    documentFrontKey: string | null;
    documentBackKey: string | null;
    selfieKey: string | null;
  },
): boolean {
  for (const slot of KYC_SLOT_ORDER) {
    const s = slots[slot];
    const legacy =
      slot === 'ID_FRONT'
        ? kyc.documentFrontKey
        : slot === 'ID_BACK'
          ? kyc.documentBackKey
          : kyc.selfieKey;
    const uploaded =
      s &&
      (s.status === 'UPLOADED' || s.status === 'VERIFIED') &&
      !!s.storageKey &&
      s.storageKey.length > 0;
    if (!uploaded && !legacy) return false;
  }
  return true;
}
