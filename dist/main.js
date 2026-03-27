"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const response_transform_interceptor_1 = require("./common/interceptors/response-transform.interceptor");
const correlation_id_middleware_1 = require("./common/middleware/correlation-id.middleware");
const express_1 = require("express");
const helmet_1 = require("helmet");
const cookieParser = require("cookie-parser");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const logging_interceptor_1 = require("./common/interceptors/logging.interceptor");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        bufferLogs: true,
    });
    const configService = app.get(config_1.ConfigService);
    const apiPrefix = configService.get('app.apiPrefix') ?? '/api/v1';
    app.setGlobalPrefix(apiPrefix);
    app.use(cookieParser());
    app.use((0, helmet_1.default)());
    app.use((0, express_1.json)({ limit: '10mb' }));
    app.use((0, express_1.urlencoded)({ extended: true, limit: '10mb' }));
    app.use(correlation_id_middleware_1.CorrelationIdMiddleware.generate);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
    }));
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    app.useGlobalInterceptors(new response_transform_interceptor_1.ResponseTransformInterceptor(), new logging_interceptor_1.LoggingInterceptor());
    app.enableCors({
        origin: configService.get('app.corsOrigin')?.split(',') ?? '*',
        credentials: true,
    });
    app.enableShutdownHooks();
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle('Cohold API')
        .setDescription('Cohold fractional real estate investment platform API (user & admin).')
        .setVersion('1.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'user-jwt')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'admin-jwt')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
    swagger_1.SwaggerModule.setup('docs', app, document, {
        swaggerOptions: {
            docExpansion: 'none',
            displayRequestDuration: true,
        },
    });
    const port = configService.get('app.port') ?? 3000;
    await app.listen(port);
}
bootstrap().catch((err) => {
    console.error('Fatal bootstrap error', err);
    process.exit(1);
});
//# sourceMappingURL=main.js.map