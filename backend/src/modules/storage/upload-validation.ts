import { BadRequestException } from '@nestjs/common';

export type UploadCategory = 'profilePhoto' | 'kycDocument' | 'propertyImage' | 'propertyDocument';

type Rules = {
  allowedContentTypes: string[];
  maxBytes: number;
};

const RULES: Record<UploadCategory, Rules> = {
  profilePhoto: {
    allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 3 * 1024 * 1024,
  },
  kycDocument: {
    allowedContentTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxBytes: 10 * 1024 * 1024,
  },
  propertyImage: {
    allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 5 * 1024 * 1024,
  },
  propertyDocument: {
    allowedContentTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    maxBytes: 15 * 1024 * 1024,
  },
};

export function assertValidUpload(input: {
  category: UploadCategory;
  contentType: string;
  fileSize: number;
  fileName?: string;
}): void {
  const rules = RULES[input.category];
  if (!rules) throw new BadRequestException('Invalid upload category');
  if (!input.contentType || !rules.allowedContentTypes.includes(input.contentType)) {
    throw new BadRequestException('Invalid file type');
  }
  if (!Number.isFinite(input.fileSize) || input.fileSize <= 0) {
    throw new BadRequestException('Invalid file size');
  }
  if (input.fileSize > rules.maxBytes) {
    throw new BadRequestException('File size exceeds limit');
  }
}

export function extensionFromFileName(fileName: string): string {
  const parts = (fileName ?? '').split('.');
  const ext = parts.length > 1 ? parts[parts.length - 1] : '';
  return ext.toLowerCase();
}

