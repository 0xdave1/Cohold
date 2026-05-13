import { BadRequestException } from '@nestjs/common';
import { assertPropertyPublishableOrThrow, MIN_PROPERTY_DISCLOSURE_LEN } from './property-publish-rules';

function baseProperty() {
  return {
    title: 'Test property',
    description: 'x'.repeat(Math.max(MIN_PROPERTY_DISCLOSURE_LEN, 25)),
    location: 'Lagos, Nigeria',
    address: '',
    city: '',
    state: '',
    country: '',
    annualYield: { toString: () => '0.12' },
    minInvestment: { toString: () => '100' },
    sharePrice: { toString: () => '1000' },
    totalValue: { toString: () => '1000000' },
    sharesTotal: { toString: () => '1000' },
    sharesSold: { toString: () => '0' },
    currentRaised: { toString: () => '0' },
    expectedReturnDisclosure: 'x'.repeat(MIN_PROPERTY_DISCLOSURE_LEN),
    riskDisclosure: 'y'.repeat(MIN_PROPERTY_DISCLOSURE_LEN),
    _count: { images: 1, documents: 0 },
  };
}

describe('assertPropertyPublishableOrThrow', () => {
  it('accepts a complete publish shape', () => {
    expect(() => assertPropertyPublishableOrThrow(baseProperty() as any)).not.toThrow();
  });

  it('rejects when expectedReturnDisclosure is too short', () => {
    expect(() =>
      assertPropertyPublishableOrThrow({
        ...baseProperty(),
        expectedReturnDisclosure: 'short',
      } as any),
    ).toThrow(BadRequestException);
  });

  it('rejects when riskDisclosure is too short', () => {
    expect(() =>
      assertPropertyPublishableOrThrow({
        ...baseProperty(),
        riskDisclosure: 'short',
      } as any),
    ).toThrow(BadRequestException);
  });

  it('rejects when annualYield is missing', () => {
    expect(() =>
      assertPropertyPublishableOrThrow({
        ...baseProperty(),
        annualYield: null,
      } as any),
    ).toThrow(BadRequestException);
  });

  it('allows location from structured fields when legacy line empty', () => {
    expect(() =>
      assertPropertyPublishableOrThrow({
        ...baseProperty(),
        location: '',
        city: 'Lagos',
        state: 'LA',
        country: 'NG',
      } as any),
    ).not.toThrow();
  });
});
