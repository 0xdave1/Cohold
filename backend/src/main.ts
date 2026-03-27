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
import { json, raw, urlencoded } from 'express';
import type { NextFunction, Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // ✅ FIX 1: Enable rawBody natively. 
    // This preserves the exact bytes needed for Paystack signature verification.
    rawBody: true,
  });

  const configService = app.get(ConfigService);
  const rawApiPrefix = configService.get<string>('config.app.apiPrefix') ?? '/api/v1';
  const apiPrefix =
    rawApiPrefix.replace(/^\/+/, '').replace(/\/+$/, '') || 'api/v1';

  app.setGlobalPrefix(apiPrefix);

  const basePath = `/${apiPrefix}`;
  const paystackWebhookPaths = [
    `${basePath}/webhooks/paystack`,
    `${basePath}/webhook/paystack`,
    `${basePath}/paystack/webhook`,
  ];

  // Security & Parsing
  app.use(cookieParser());
  app.use(helmet());

  // Paystack signs the exact raw JSON bytes — capture Buffer before express.json() parses.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'POST' && paystackWebhookPaths.includes(req.path)) {
      return raw({ type: 'application/json', limit: '10mb' })(req, res, next);
    }
    return next();
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'POST' && paystackWebhookPaths.includes(req.path)) {
      return next();
    }
    return json({ limit: '10mb' })(req, res, next);
  });
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

  // ✅ FIX 2: Update CORS to include your specific ngrok URL.
  // This prevents the "Redirect to Login" issue caused by cross-domain cookie blocks.
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://unpropitiative-cristie-unfouled.ngrok-free.dev', 
    ],
    credentials: true,
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
  console.log(`🚀 Server running on: https://unpropitiative-cristie-unfouled.ngrok-free.dev/${apiPrefix}`);
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});