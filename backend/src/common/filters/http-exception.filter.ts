import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { correlationId?: string }>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = isHttpException
      ? (exception.getResponse() as any)
      : { message: 'Internal server error' };

    const message =
      typeof errorResponse === 'string'
        ? errorResponse
        : errorResponse.message || 'Internal server error';

    const error =
      typeof errorResponse === 'string'
        ? { message }
        : { ...errorResponse, message };

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      // Do not leak stack traces to clients. Log server-side instead.
      console.error('Unhandled exception', {
        correlationId: request.correlationId,
        error: exception,
      });
    }

    response.status(status).json({
      success: false,
      error,
      meta: {
        correlationId: request.correlationId,
        path: request.url,
      },
    });
  }
}

