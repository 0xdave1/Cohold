import {
  CallHandler,
  ExecutionContext,
  Logger,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { redactSensitive } from '../logging/security-redaction.util';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const req = context.switchToHttp().getRequest<Request & { correlationId?: string; user?: any; admin?: any }>();

    const method = (req as any)?.method;
    const url = (req as any)?.url;
    const correlationId = (req as any)?.correlationId;

    return next.handle().pipe(
      tap(() => {
        const latency = Date.now() - now;
        this.logger.log(
          JSON.stringify(
            redactSensitive({
            level: 'info',
            msg: 'http_request',
            method,
            url,
            latencyMs: latency,
            correlationId,
            userId: (req as any)?.user?.id,
              adminId: (req as any)?.user?.role ? (req as any)?.user?.id : undefined,
              headers: {
                authorization: (req as any)?.headers?.authorization,
                cookie: (req as any)?.headers?.cookie,
              },
            }),
          ),
        );
      }),
    );
  }
}

