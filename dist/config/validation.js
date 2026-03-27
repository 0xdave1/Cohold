"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validationSchema = void 0;
const Joi = require("joi");
exports.validationSchema = Joi.object({
    NODE_ENV: Joi.string()
        .valid('development', 'staging', 'production', 'test')
        .default('development'),
    PORT: Joi.number().default(3000),
    API_PREFIX: Joi.string().default('/api/v1'),
    DATABASE_URL: Joi.string().uri().required(),
    REDIS_URL: Joi.string().uri().required(),
    JWT_USER_SECRET: Joi.string().min(32).required(),
    JWT_USER_ACCESS_TTL: Joi.string().default('15m'),
    JWT_USER_REFRESH_TTL: Joi.string().default('7d'),
    JWT_ADMIN_SECRET: Joi.string().min(32).required(),
    JWT_ADMIN_ACCESS_TTL: Joi.string().default('15m'),
    JWT_ADMIN_REFRESH_TTL: Joi.string().default('7d'),
    PAYSTACK_SECRET_KEY: Joi.string().required(),
    PAYSTACK_WEBHOOK_SECRET: Joi.string().required(),
    S3_ACCESS_KEY: Joi.string().required(),
    S3_SECRET_KEY: Joi.string().required(),
    S3_BUCKET: Joi.string().required(),
    S3_REGION: Joi.string().required(),
    S3_ENDPOINT: Joi.string().uri().required(),
    EMAIL_API_KEY: Joi.string().required(),
    EMAIL_FROM: Joi.string().email().required(),
    ELASTICSEARCH_NODE: Joi.string().uri().optional(),
});
//# sourceMappingURL=validation.js.map