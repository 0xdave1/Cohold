import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Storage service for S3-compatible storage (AWS S3 or Cloudflare R2).
 * Handles document uploads and signed URL generation.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const accessKey = this.configService.get<string>('s3.accessKey');
    const secretKey = this.configService.get<string>('s3.secretKey');
    const endpoint = this.configService.get<string>('s3.endpoint');
    const region = this.configService.get<string>('s3.region');
    this.bucket = this.configService.get<string>('s3.bucket') ?? 'cohold-documents';

    if (!accessKey || !secretKey) {
      this.logger.warn('S3 credentials not configured; storage disabled');
      return;
    }

    this.s3Client = new S3Client({
      region: region ?? 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: endpoint?.includes('r2.cloudflarestorage.com'), // R2 requires path-style
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
   * Generate a signed URL for document access (short TTL for security).
   * @param key S3 key
   * @param expiresInSeconds URL expiration time (default: 5 minutes)
   * @returns Signed URL
   */
  async getSignedUrl(key: string, expiresInSeconds = 300): Promise<string> {
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
   * Generate S3 key for KYC document.
   */
  generateKycDocumentKey(userId: string, documentType: 'id-front' | 'id-back' | 'selfie'): string {
    const timestamp = Date.now();
    const ext = documentType === 'selfie' ? 'jpg' : 'pdf';
    return `kyc/${userId}/${documentType}-${timestamp}.${ext}`;
  }

  /**
   * Generate S3 key for property document.
   */
  generatePropertyDocumentKey(propertyId: string, documentType: string): string {
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
