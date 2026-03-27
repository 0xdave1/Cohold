// This is handled via multipart/form-data in the controller
// DTO is mainly for Swagger documentation

export class UploadDocumentDto {
  /**
   * Document type: 'id-front' | 'id-back' | 'selfie'
   */
  documentType!: 'id-front' | 'id-back' | 'selfie';
}
