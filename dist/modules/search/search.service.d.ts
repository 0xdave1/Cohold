import { ConfigService } from '@nestjs/config';
export declare class SearchService {
    private readonly configService;
    private client;
    constructor(configService: ConfigService);
    private ensureClient;
    indexProperty(document: Record<string, any>): Promise<void>;
}
