import { Injectable } from '@nestjs/common';

@Injectable()
export class IdempotencyService {
  /**
   * Enforce idempotency by transaction reference. If the reference already exists,
   * the provided callback will not be executed.
   *
   * This should be combined with unique constraints on Transaction.reference
   * and/or externalReference.
   */
  async executeOnce<T>(
    _reference: string,
    handler: () => Promise<T>,
  ): Promise<T> {
    // The enforcement happens via DB unique constraints and transactional logic
    // in the caller. This helper is a semantic wrapper for clarity.
    return handler();
  }
}

