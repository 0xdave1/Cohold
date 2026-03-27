"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = require("ioredis");
let CacheService = class CacheService {
    constructor(configService) {
        this.configService = configService;
    }
    onModuleInit() {
        const url = this.configService.get('redis.url');
        if (!url) {
            throw new Error('REDIS_URL not configured');
        }
        this.client = new ioredis_1.default(url, {
            maxRetriesPerRequest: null,
        });
    }
    async onModuleDestroy() {
        if (this.client) {
            await this.client.quit();
        }
    }
    async get(key) {
        const value = await this.client.get(key);
        if (!value)
            return null;
        return JSON.parse(value);
    }
    async set(key, value, ttlSeconds) {
        const payload = JSON.stringify(value);
        if (ttlSeconds && ttlSeconds > 0) {
            await this.client.set(key, payload, 'EX', ttlSeconds);
        }
        else {
            await this.client.set(key, payload);
        }
    }
    async del(key) {
        await this.client.del(key);
    }
};
exports.CacheService = CacheService;
exports.CacheService = CacheService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], CacheService);
//# sourceMappingURL=cache.service.js.map