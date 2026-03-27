export type ListingMode = 'fractional' | 'land' | 'own-home';

export function detectListingMode(title: string, description: string): ListingMode {
  const source = `${title} ${description}`.toLowerCase();
  if (source.includes('land') || source.includes('estate')) return 'land';
  // Avoid classifying typical fractional listings (e.g. duplex terraces) as own-home.
  if (
    source.includes('own a home') ||
    source.includes('own home') ||
    source.includes('mubi homes') ||
    (source.includes('installment') && (source.includes('home') || source.includes('house')))
  ) {
    return 'own-home';
  }
  return 'fractional';
}

export function modeLabel(mode: ListingMode): string {
  if (mode === 'land') return 'Land';
  if (mode === 'own-home') return 'Ownership';
  return 'Fractional';
}
