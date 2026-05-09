import { ConfigService } from '@nestjs/config';
import {
  assertProductionSecurityConfig,
  parseOrigins,
  shouldEnableSwagger,
} from './common/http/bootstrap-security';

describe('main security bootstrap controls', () => {
  it('disables swagger in production by default', () => {
    expect(shouldEnableSwagger('production', false)).toBe(false);
    expect(shouldEnableSwagger('production', true)).toBe(true);
    expect(shouldEnableSwagger('development', false)).toBe(true);
  });

  it('parses and normalizes comma separated origins', () => {
    expect(parseOrigins(' https://a.com/,http://localhost:3000 ,,')).toEqual([
      'https://a.com',
      'http://localhost:3000',
    ]);
  });

  it('rejects wildcard credentials CORS in production', () => {
    const configService = {
      get: (key: string) => {
        if (key === 'config.app.env') return 'production';
        if (key === 'config.app.corsCredentials') return true;
        if (key === 'config.app.effectiveCorsAllowedOrigins') return ['*'];
        return undefined;
      },
    } as unknown as ConfigService;
    expect(() => assertProductionSecurityConfig(configService)).toThrow(
      'Unsafe CORS config',
    );
  });
});
