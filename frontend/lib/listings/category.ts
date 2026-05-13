export type ListingMode = 'fractional' | 'land' | 'own-home';

/** Prefer API `listingType`; maps Prisma `ListingType` to dashboard routing mode. */
export function listingTypeToMode(listingType: string | null | undefined): ListingMode {
  if (listingType === 'LAND_ACQUISITION') return 'land';
  if (listingType === 'OWN_A_HOME') return 'own-home';
  return 'fractional';
}

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

/**
 * Single source of truth for UI mode: backend `listingType` when present,
 * otherwise legacy keyword fallback only for older rows.
 */
export function resolveListingMode(property: {
  listingType?: string | null;
  title: string;
  description: string;
}): ListingMode {
  if (property.listingType && String(property.listingType).trim() !== '') {
    return listingTypeToMode(property.listingType);
  }
  return detectListingMode(property.title, property.description);
}

export function modeLabel(mode: ListingMode): string {
  if (mode === 'land') return 'Land';
  if (mode === 'own-home') return 'Ownership';
  return 'Fractional';
}

/** Short label for listing pills from API enum (or derived mode). */
export function listingTypePillLabel(listingType: string | null | undefined): string {
  if (listingType === 'LAND_ACQUISITION') return 'Land';
  if (listingType === 'OWN_A_HOME') return 'Own a home';
  if (listingType === 'FRACTIONAL_OWNERSHIP') return 'Fractional';
  return modeLabel(listingTypeToMode(listingType));
}
