import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
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
import {
  assertProductionSecurityConfig,
  buildCorsOriginValidator,
  shouldEnableSwagger,
} from './common/http/bootstrap-security';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
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

  assertProductionSecurityConfig(configService);

  app.use(cookieParser());
  const isProd = String(configService.get<string>('config.app.env')) === 'production';
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              frameAncestors: ["'none'"],
              objectSrc: ["'none'"],
            },
          }
        : false,
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: isProd ? { maxAge: 15552000, includeSubDomains: true, preload: false } : false,
    }),
  );

  const bodyLimit = String(configService.get<string>('config.app.bodyLimit') ?? '1mb');
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  app.use(CorrelationIdMiddleware.generate);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidUnknownValues: true,
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new ResponseTransformInterceptor(),
    new LoggingInterceptor(),
  );

  const allowedOrigins = configService.get<string[]>('config.app.effectiveCorsAllowedOrigins') ?? [];
  app.enableCors({
    origin: buildCorsOriginValidator(allowedOrigins),
    credentials: Boolean(configService.get<boolean>('config.app.corsCredentials')),
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Correlation-Id'],
  });

  app.enableShutdownHooks();

  const enableSwagger = Boolean(configService.get<boolean>('config.app.enableSwagger'));
  if (shouldEnableSwagger(String(configService.get<string>('config.app.env')), enableSwagger)) {
    if (isProd) {
      const docsUser = configService.get<string>('config.app.swaggerUsername');
      const docsPass = configService.get<string>('config.app.swaggerPassword');
      expressApp.use('/docs', (req: any, res: any, next: any) => {
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith('Basic ')) {
          res.setHeader('WWW-Authenticate', 'Basic realm="Cohold Docs"');
          res.status(401).send('Authentication required');
          return;
        }
        const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
        if (user !== docsUser || pass !== docsPass) {
          res.status(403).send('Forbidden');
          return;
        }
        next();
      });
    }
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Cohold API')
      .setDescription('Cohold fractional real estate investment platform API.')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'user-jwt')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'admin-jwt')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  } else {
    logger.log('Swagger disabled by secure production default.');
  }

  const port = configService.get<number>('config.app.port') ?? 3000;
  await app.listen(port);
  const apiPath = `/${apiPrefix}`;
  logger.log(`Server listening on port ${port} (global prefix ${apiPath})`);
}

bootstrap().catch((err) => {
  const logger = new Logger('Bootstrap');
  logger.error('Fatal bootstrap error', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
