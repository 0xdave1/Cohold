"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nestjs/config");
exports.default = (0, config_1.registerAs)('config', () => ({
    app: {
        env: process.env.NODE_ENV ?? 'development',
        port: parseInt(process.env.PORT ?? '3000', 10),
        apiPrefix: process.env.API_PREFIX ?? '/api/v1',
        corsOrigin: process.env.CORS_ORIGIN ?? '*',
    },
    elasticsearch: {
        node: process.env.ELASTICSEARCH_NODE,
    },
    db: {
        url: process.env.DATABASE_URL,
    },
    redis: {
        url: process.env.REDIS_URL,
    },
    jwtUser: {
        secret: process.env.JWT_USER_SECRET,
        accessTtl: process.env.JWT_USER_ACCESS_TTL ?? '15m',
        refreshTtl: process.env.JWT_USER_REFRESH_TTL ?? '7d',
        audience: 'cohold-user',
    },
    jwtAdmin: {
        secret: process.env.JWT_ADMIN_SECRET,
        accessTtl: process.env.JWT_ADMIN_ACCESS_TTL ?? '15m',
        refreshTtl: process.env.JWT_ADMIN_REFRESH_TTL ?? '7d',
        audience: 'cohold-admin',
    },
    paystack: {
        secretKey: process.env.PAYSTACK_SECRET_KEY,
        webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
    },
    s3: {
        accessKey: process.env.S3_ACCESS_KEY,
        secretKey: process.env.S3_SECRET_KEY,
        bucket: process.env.S3_BUCKET,
        region: process.env.S3_REGION,
        endpoint: process.env.S3_ENDPOINT,
    },
    email: {
        apiKey: process.env.EMAIL_API_KEY,
        from: process.env.EMAIL_FROM,
    },
}));
//# sourceMappingURL=configuration.js.map