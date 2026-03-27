import { Request, Response, NextFunction } from 'express';
export declare const CORRELATION_ID_HEADER = "x-request-id";
export declare class CorrelationIdMiddleware {
    static generate(req: Request, res: Response, next: NextFunction): void;
}
