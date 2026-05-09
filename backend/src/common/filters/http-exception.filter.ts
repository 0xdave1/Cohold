import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { sanitizeErrorForLog } from '../logging/security-redaction.util';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  private isPrismaKnownRequestError(
    exception: unknown,
  ): exception is Prisma.PrismaClientKnownRequestError {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) return true;
    if (!exception || typeof exception !== 'object') return false;
    const maybe = exception as Record<string, unknown>;
    return (
      typeof maybe.code === 'string' &&
      typeof maybe.message === 'string' &&
      String(maybe.name ?? '').includes('PrismaClientKnownRequestError')
    );
  }

  private mapPrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    status: HttpStatus;
    message: string;
    code: string;
  } {
    if (exception.code === 'P2002') {
      return { status: HttpStatus.CONFLICT, message: 'Resource already exists', code: 'UNIQUE_CONFLICT' };
    }
    if (exception.code === 'P2025') {
      return { status: HttpStatus.NOT_FOUND, message: 'Resource not found', code: 'NOT_FOUND' };
    }
    return { status: HttpStatus.BAD_REQUEST, message: 'Database request failed', code: 'DB_REQUEST_FAILED' };
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { correlationId?: string }>();
    const isProd = process.env.NODE_ENV === 'production';

    const isHttpException = exception instanceof HttpException;
    const prismaKnown = this.isPrismaKnownRequestError(exception) ? exception : null;
    const prismaMapped = prismaKnown ? this.mapPrismaError(prismaKnown) : null;
    const status = prismaMapped?.status ?? (isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR);

    const errorResponse = isHttpException
      ? (exception.getResponse() as any)
      : prismaMapped
        ? { message: prismaMapped.message, code: prismaMapped.code }
        : { message: 'Internal server error' };

    const message =
      typeof errorResponse === 'string'
        ? errorResponse
        : errorResponse.message || 'Internal server error';

    const error =
      typeof errorResponse === 'string'
        ? { message }
        : { ...errorResponse, message };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error('Unhandled exception', JSON.stringify({
        correlationId: request.correlationId,
        error: sanitizeErrorForLog(exception),
      }));
    }

    if (status >= HttpStatus.BAD_REQUEST && status < HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.warn(
        JSON.stringify({
          msg: 'handled_exception',
          correlationId: request.correlationId,
          path: request.url,
          status,
          error: sanitizeErrorForLog(error),
        }),
      );
    }

    const safeError =
      isProd && status === HttpStatus.INTERNAL_SERVER_ERROR
        ? { message: 'Internal server error', code: 'INTERNAL_ERROR' }
        : error;

    response.status(status).json({
      success: false,
      error: safeError,
      meta: {
        correlationId: request.correlationId,
        path: request.url,
      },
    });
  }
}

