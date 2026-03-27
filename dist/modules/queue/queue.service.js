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
exports.QueueService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bullmq_1 = require("bullmq");
let QueueService = class QueueService {
    constructor(configService) {
        this.configService = configService;
        this.queues = new Map();
    }
    getConnection() {
        const url = this.configService.get('redis.url');
        if (!url) {
            throw new Error('REDIS_URL not configured');
        }
        return {
            connection: { url },
        };
    }
    getQueue(name) {
        if (this.queues.has(name)) {
            return this.queues.get(name);
        }
        const queue = new bullmq_1.Queue(name, this.getConnection());
        this.queues.set(name, queue);
        return queue;
    }
    async addJob(name, jobName, data, opts) {
        const queue = this.getQueue(name);
        await queue.add(jobName, data, opts);
    }
    createWorker(name, processor) {
        return new bullmq_1.Worker(name, processor, this.getConnection());
    }
};
exports.QueueService = QueueService;
exports.QueueService = QueueService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], QueueService);
//# sourceMappingURL=queue.service.js.map