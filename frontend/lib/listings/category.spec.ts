import { describe, expect, it } from 'vitest';
import { listingTypePillLabel, listingTypeToMode, resolveListingMode } from './category';

describe('resolveListingMode', () => {
  it('uses backend listingType when present', () => {
    expect(
      resolveListingMode({
        listingType: 'LAND_ACQUISITION',
        title: 'Fractional terrace',
        description: 'Nothing about land here',
      }),
    ).toBe('land');
  });

  it('falls back to keyword detection when listingType missing', () => {
    expect(
      resolveListingMode({
        listingType: null,
        title: 'Estate land',
        description: 'Plot',
      }),
    ).toBe('land');
  });
});

describe('listingTypeToMode', () => {
  it('maps enums', () => {
    expect(listingTypeToMode('OWN_A_HOME')).toBe('own-home');
    expect(listingTypeToMode('FRACTIONAL_OWNERSHIP')).toBe('fractional');
  });
});

describe('listingTypePillLabel', () => {
  it('renders human labels without implying certificate verification', () => {
    expect(listingTypePillLabel('FRACTIONAL_OWNERSHIP')).toBe('Fractional');
    expect(listingTypePillLabel('LAND_ACQUISITION')).toBe('Land');
    expect(listingTypePillLabel('OWN_A_HOME')).toBe('Own a home');
  });
});
