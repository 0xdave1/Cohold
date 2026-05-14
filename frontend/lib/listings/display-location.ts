/** City-first line for listing cards (Figma: “Abuja” not full address). */
export function shortLocationForListingCard(p: {
  city?: string | null;
  displayLocation?: string | null;
  location: string;
}): string {
  const c = (p.city ?? '').trim();
  if (c) return c;
  const d = (p.displayLocation ?? '').trim();
  if (d) {
    const first = d.split(',')[0]?.trim();
    return first || d;
  }
  const loc = (p.location ?? '').trim();
  if (!loc) return '';
  return loc.split(',')[0]?.trim() || loc;
}
