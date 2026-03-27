import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

export const CORRELATION_ID_HEADER = 'x-request-id';

export class CorrelationIdMiddleware {
  static generate(req: Request, res: Response, next: NextFunction): void {
    const incomingId =
      (req.headers[CORRELATION_ID_HEADER] as string | undefined) ??
      (req.headers['x-correlation-id'] as string | undefined);

    const correlationId = incomingId || randomUUID();

    (req as any).correlationId = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}

