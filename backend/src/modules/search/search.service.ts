import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class SearchService {
  private client: Client | null = null;

  constructor(private readonly configService: ConfigService) {
    const node = this.configService.get<string>('elasticsearch.node');
    if (node) {
      this.client = new Client({ node });
    }
  }

  private ensureClient(): Client {
    if (!this.client) {
      throw new Error(
        'Elasticsearch not configured. Set ELASTICSEARCH_NODE in environment.',
      );
    }
    return this.client;
  }

  async indexProperty(document: Record<string, any>): Promise<void> {
    const client = this.ensureClient();
    await client.index({
      index: 'properties',
      id: document.id,
      document,
    });
  }

  // Additional index/search methods for users, transactions, etc. can be added here.
}

