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
exports.SearchService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const elasticsearch_1 = require("@elastic/elasticsearch");
let SearchService = class SearchService {
    constructor(configService) {
        this.configService = configService;
        this.client = null;
        const node = this.configService.get('elasticsearch.node');
        if (node) {
            this.client = new elasticsearch_1.Client({ node });
        }
    }
    ensureClient() {
        if (!this.client) {
            throw new Error('Elasticsearch not configured. Set ELASTICSEARCH_NODE in environment.');
        }
        return this.client;
    }
    async indexProperty(document) {
        const client = this.ensureClient();
        await client.index({
            index: 'properties',
            id: document.id,
            document,
        });
    }
};
exports.SearchService = SearchService;
exports.SearchService = SearchService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SearchService);
//# sourceMappingURL=search.service.js.map