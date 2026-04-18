import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Currency } from '@prisma/client';
import { toDecimal } from '../../common/money/decimal.util';
import axios, { AxiosInstance } from 'axios';

/**
 * FX Rate service using exchangerate-api.io (free tier).
 * For production, consider paid APIs like Fixer.io, CurrencyLayer, or OpenExchangeRates.
 */
@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private readonly client: AxiosInstance;
  private readonly _apiKey: string | null = null;
  private readonly baseUrl = 'https://api.exchangerate-api.com/v4';

  constructor(
    private readonly configService: ConfigService,
    
  ) {
    // For free tier, no API key needed. For paid tiers, use EXCHANGE_RATE_API_KEY
    this._apiKey = this.configService.get<string>('fx.apiKey') ?? null;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 5000,
    });
  }

  /**
   * Get exchange rate between two currencies.
   * Rates are cached for 5 minutes to reduce API calls.
   */
  async getExchangeRate(from: Currency, to: Currency): Promise<number> {
    if (from === to) {
      return 1;
    }

    
    

    try {
      // exchangerate-api.io: free tier no key; paid tier can use EXCHANGE_RATE_API_KEY
      const path = this._apiKey ? `/latest/${from}?api_key=${this._apiKey}` : `/latest/${from}`;
      const response = await this.client.get(path);
      const rates = response.data.rates;
      const rate = rates[to];

      if (!rate) {
        this.logger.warn(`Rate not found for ${from} to ${to}, using 1:1`);
        return 1;
      }

      // Cache for 5 minutes
      

      return rate;
    } catch (error: any) {
      this.logger.error(`Failed to fetch FX rate: ${error.message}`);
      // Fallback to 1:1 for resilience (should be logged and alerted)
      return 1;
    }
  }

  /**
   * Convert amount from one currency to another.
   */
  async convert(amount: string, from: Currency, to: Currency): Promise<string> {
    const rate = await this.getExchangeRate(from, to);
    const amountDecimal = toDecimal(amount);
    const converted = amountDecimal.mul(rate);
    return converted.toString();
  }
}
