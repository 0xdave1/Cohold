import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { json, urlencoded } from 'express';

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

function buildCorsOriginValidator(configService: ConfigService): (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void {
  const defaults = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://cohold.co',
    'https://www.cohold.co',
    'https://cohold.vercel.app',
    'https://cohold.onrender.com',
  ];
  const fromConfig = String(configService.get<string>('config.app.corsOrigin') ?? '')
    .split(',')
    .map((s) => normalizeOrigin(s))
    .filter((s) => s.length > 0 && s !== '*');
  const allowed = new Set<string>([...defaults.map(normalizeOrigin), ...fromConfig]);

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    callback(null, allowed.has(normalizeOrigin(origin)));
  };
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const configService = app.get(ConfigService);
  const rawApiPrefix = configService.get<string>('config.app.apiPrefix') ?? '/api/v1';
  const apiPrefix = rawApiPrefix.replace(/^\/+/, '').replace(/\/+$/, '') || 'api/v1';

  app.setGlobalPrefix(apiPrefix);

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  app.use(cookieParser());
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  app.use(CorrelationIdMiddleware.generate);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new ResponseTransformInterceptor(),
    new LoggingInterceptor(),
  );

  app.enableCors({
    origin: buildCorsOriginValidator(configService),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Correlation-Id'],
  });

  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Cohold API')
    .setDescription('Cohold fractional real estate investment platform API.')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'user-jwt')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'admin-jwt')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = configService.get<number>('config.app.port') ?? 3000;
  await app.listen(port);
  const apiPath = `/${apiPrefix}`;
  console.log(`Server listening on port ${port} (global prefix ${apiPath})`);
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
