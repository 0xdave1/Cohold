import { BadRequestException } from '@nestjs/common';
import { toDecimal } from '../../common/money/decimal.util';

/**
 * Accepts unitless rate (0–1] or percent (1–100]; persists as unitless for `Property.annualYield`.
 */
export function parseAnnualYieldToStoredUnitless(raw: string | undefined) {
  if (raw === undefined || `${raw}`.trim() === '') return null;
  const d = toDecimal(`${raw}`.trim());
  if (d.lt(0)) {
    throw new BadRequestException('Yield cannot be negative.');
  }
  if (d.gt(100)) {
    throw new BadRequestException('Yield out of allowed range (max 100% or unitless 1).');
  }
  if (d.gt(1)) {
    return d.div(100);
  }
  return d;
}

export function coerceFeaturesJson(features?: string[]): string[] {
  if (!features?.length) return [];
  return features.map((f) => f.trim()).filter(Boolean).slice(0, 50);
}

export function featuresToPrismaJson(features?: string[]): string[] {
  return coerceFeaturesJson(features);
}

export function parseFeaturesFromDb(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}
