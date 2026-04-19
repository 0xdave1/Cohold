import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

/**
 * Storage service for S3-compatible storage (AWS S3 or Cloudflare R2).
 * Handles document uploads and signed URL generation.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;
  private readonly bucket: string;
  private readonly endpoint?: string;
  private readonly region?: string;
  private readonly accessKeyId?: string;
  private readonly secretAccessKey?: string;

  constructor(private readonly configService: ConfigService) {
    // Backwards compatible env mapping:
    // - existing config uses S3_ACCESS_KEY / S3_SECRET_KEY
    // - new expected names use S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY
    const accessKey = this.configService.get<string>('s3.accessKeyId');
    const secretKey = this.configService.get<string>('s3.secretAccessKey');
    const endpoint = this.configService.get<string>('s3.endpoint');
    const region = this.configService.get<string>('s3.region');
    this.bucket = this.configService.get<string>('s3.bucket') ?? 'cohold-assets';

    this.endpoint = endpoint ?? undefined;
    this.region = region ?? undefined;
    this.accessKeyId = accessKey ?? undefined;
    this.secretAccessKey = secretKey ?? undefined;

    if (!this.accessKeyId || !this.secretAccessKey || !this.endpoint) {
      this.logger.warn('S3 credentials not configured; storage disabled');
      return;
    }

    this.s3Client = this.createS3Client();
  }

  createS3Client(): S3Client {
    if (!this.endpoint || !this.accessKeyId || !this.secretAccessKey) {
      throw new Error('S3 client not configured');
    }
    const endpoint = this.endpoint;
    return new S3Client({
      region: this.region ?? 'auto',
      endpoint,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
      forcePathStyle: endpoint.includes('r2.cloudflarestorage.com'), // R2 requires path-style
    });
  }

  /**
   * Upload a document to S3/R2.
   * @param key S3 key (e.g., 'kyc/user-123/id-front.jpg')
   * @param buffer File buffer
   * @param contentType MIME type (e.g., 'image/jpeg', 'application/pdf')
   * @returns S3 key
   */
  async uploadDocument(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 client not configured');
    }

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          // Server-side encryption if needed:
          // ServerSideEncryption: 'AES256',
        }),
      );

      this.logger.log(`Document uploaded: ${key}`);
      return key;
    } catch (error: any) {
      this.logger.error(`Failed to upload document ${key}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate a signed read URL for private object access (short TTL for security).
   */
  async createSignedReadUrl(key: string, expiresInSeconds = 300): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 client not configured');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });

      return url;
    } catch (error: any) {
      this.logger.error(`Failed to generate signed URL for ${key}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate a presigned PUT URL for direct uploads (user/admin clients upload to S3/R2).
   * The returned URL is short-lived and should be used immediately.
   */
  async createPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds = 900,
  ): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 client not configured');
    }
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  // Backwards-compatible aliases used by Support module today.
  async getSignedUrl(key: string, expiresInSeconds = 300): Promise<string> {
    return this.createSignedReadUrl(key, expiresInSeconds);
  }
  async getPresignedPutUrl(key: string, contentType: string, expiresInSeconds = 300): Promise<string> {
    return this.createPresignedUploadUrl(key, contentType, expiresInSeconds);
  }

  private assertExtension(ext: string): string {
    const cleaned = ext.replace(/^\./, '').toLowerCase();
    if (!/^[a-z0-9]{1,10}$/.test(cleaned)) {
      throw new BadRequestException('Invalid file extension');
    }
    return cleaned;
  }

  generateProfilePhotoKey(userId: string, extension: string): string {
    const ext = this.assertExtension(extension);
    return `users/${userId}/profile/${uuidv4()}.${ext}`;
  }

  generateKycDocumentKey(userId: string, docType: string, extension: string): string {
    const ext = this.assertExtension(extension);
    const safeDoc = docType.replace(/[^\w\-]+/g, '_').slice(0, 32);
    return `users/${userId}/kyc/${safeDoc}/${uuidv4()}.${ext}`;
  }

  generatePropertyImageKey(propertyId: string, extension: string): string {
    const ext = this.assertExtension(extension);
    return `properties/${propertyId}/images/${uuidv4()}.${ext}`;
  }

  generatePropertyDocumentKey(propertyId: string, extension: string): string {
    const ext = this.assertExtension(extension);
    return `properties/${propertyId}/documents/${uuidv4()}.${ext}`;
  }

  /**
   * Generate S3 key for support attachments.
   */
  generateSupportAttachmentKey(conversationId: string, messageId: string, fileName?: string | null): string {
    const timestamp = Date.now();
    const safeName = (fileName ?? 'attachment')
      .replace(/[^\w.\-]+/g, '_')
      .slice(0, 120);
    return `support/${conversationId}/${messageId}/${timestamp}-${safeName}`;
  }

  /**
   * Legacy KYC key generator (kept for compatibility). Prefer generateKycDocumentKey(userId, docType, extension).
   */
  generateKycDocumentKeyLegacy(userId: string, documentType: 'id-front' | 'id-back' | 'selfie'): string {
    const timestamp = Date.now();
    const ext = documentType === 'selfie' ? 'jpg' : 'pdf';
    return `kyc/${userId}/${documentType}-${timestamp}.${ext}`;
  }

  /**
   * Generate S3 key for property document.
   * Legacy (kept for compatibility). Prefer generatePropertyDocumentKey(propertyId, extension).
   */
  generatePropertyDocumentKeyLegacy(propertyId: string, documentType: string): string {
    const timestamp = Date.now();
    return `properties/${propertyId}/${documentType}-${timestamp}.pdf`;
  }

  /**
   * Generate S3 key for investment document (signed agreements, receipts).
   */
  generateInvestmentDocumentKey(investmentId: string, documentType: 'agreement' | 'receipt'): string {
    const timestamp = Date.now();
    return `investments/${investmentId}/${documentType}-${timestamp}.pdf`;
  }
}
