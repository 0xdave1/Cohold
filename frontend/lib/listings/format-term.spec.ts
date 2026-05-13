import { describe, expect, it } from 'vitest';
import { formatTermForDetail, formatTermForListingCard } from './format-term';

describe('formatTermForListingCard', () => {
  it('uses neutral copy when term missing', () => {
    expect(formatTermForListingCard(null)).toBe('Term not specified');
    expect(formatTermForListingCard(undefined)).toBe('Term not specified');
  });
});

describe('formatTermForDetail', () => {
  it('uses neutral copy when term missing', () => {
    expect(formatTermForDetail(null)).toBe('Not specified.');
  });

  it('formats whole years', () => {
    expect(formatTermForDetail(24)).toBe('2 years');
  });
});
