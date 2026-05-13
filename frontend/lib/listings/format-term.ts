/** Listing card copy when `termMonths` is absent (no alarming “TBD”). */
export function formatTermForListingCard(termMonths: number | null | undefined): string {
  if (termMonths == null || !Number.isFinite(termMonths) || termMonths <= 0) {
    return 'Term not specified';
  }
  if (termMonths % 12 === 0) {
    const y = termMonths / 12;
    return `${y} year${y === 1 ? '' : 's'}`;
  }
  return `${termMonths} months`;
}

/** Property detail / investment copy when term is absent. */
export function formatTermForDetail(termMonths: number | null | undefined): string {
  if (termMonths == null || !Number.isFinite(termMonths) || termMonths <= 0) {
    return 'Not specified.';
  }
  if (termMonths % 12 === 0) {
    const y = termMonths / 12;
    return `${y} year${y === 1 ? '' : 's'}`;
  }
  return `${termMonths} months`;
}
