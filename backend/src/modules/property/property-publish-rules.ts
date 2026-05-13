import { BadRequestException } from '@nestjs/common';
import { toDecimal } from '../../common/money/decimal.util';

/** Minimum length for user-facing risk / return disclosures on publish. */
export const MIN_PROPERTY_DISCLOSURE_LEN = 20;

type PublishShape = {
  title: string;
  description: string;
  location: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  annualYield: { toString(): string } | null;
  minInvestment: { toString(): string };
  sharePrice: { toString(): string };
  totalValue: { toString(): string };
  sharesTotal: { toString(): string };
  sharesSold: { toString(): string };
  currentRaised: { toString(): string };
  expectedReturnDisclosure?: string | null;
  riskDisclosure?: string | null;
  _count: { images: number; documents: number };
};

function structuredLocationPresent(p: PublishShape): boolean {
  const parts = [p.address, p.city, p.state, p.country].map((x) => (x ?? '').trim()).filter(Boolean);
  return parts.length > 0;
}

/**
 * Shared publish gate for admin (and legacy property publish route).
 * Does not change title/legal enums — publish must never auto-verify title.
 */
export function assertPropertyPublishableOrThrow(property: PublishShape): void {
  const title = property.title?.trim() ?? '';
  const desc = property.description?.trim() ?? '';
  if (title.length < 2) {
    throw new BadRequestException('Property title is too short to publish.');
  }
  if (desc.length < MIN_PROPERTY_DISCLOSURE_LEN) {
    throw new BadRequestException('Property description must be at least 20 characters to publish.');
  }
  const loc = property.location?.trim() ?? '';
  if (loc.length < 2 && !structuredLocationPresent(property)) {
    throw new BadRequestException('Provide location (legacy line) or address/city/state/country before publishing.');
  }
  if (property.annualYield == null) {
    throw new BadRequestException('Property cannot be published without a disclosed annual yield (annualYield).');
  }
  if (toDecimal(property.annualYield.toString()).lte(0)) {
    throw new BadRequestException('annualYield must be a positive disclosed rate.');
  }
  const exp = (property.expectedReturnDisclosure ?? '').trim();
  const risk = (property.riskDisclosure ?? '').trim();
  if (exp.length < MIN_PROPERTY_DISCLOSURE_LEN) {
    throw new BadRequestException(
      `expectedReturnDisclosure must be at least ${MIN_PROPERTY_DISCLOSURE_LEN} characters before publish.`,
    );
  }
  if (risk.length < MIN_PROPERTY_DISCLOSURE_LEN) {
    throw new BadRequestException(
      `riskDisclosure must be at least ${MIN_PROPERTY_DISCLOSURE_LEN} characters before publish.`,
    );
  }
  if (
    toDecimal(property.minInvestment.toString()).lte(0) ||
    toDecimal(property.sharePrice.toString()).lte(0) ||
    toDecimal(property.totalValue.toString()).lte(0)
  ) {
    throw new BadRequestException('minInvestment, sharePrice, and totalValue must be positive before publish.');
  }
  const mediaCount = property._count.images + property._count.documents;
  if (mediaCount < 1) {
    throw new BadRequestException('At least one image or document is required before publishing.');
  }
  if (toDecimal(property.sharesTotal.toString()).lte(0)) {
    throw new BadRequestException('sharesTotal must be positive before publish.');
  }
  if (toDecimal(property.sharesSold.toString()).lt(0)) {
    throw new BadRequestException('sharesSold cannot be negative.');
  }
  if (toDecimal(property.sharesSold.toString()).gt(toDecimal(property.sharesTotal.toString()))) {
    throw new BadRequestException('Property inventory inconsistency: sharesSold exceeds sharesTotal.');
  }
  if (toDecimal(property.currentRaised.toString()).gt(toDecimal(property.totalValue.toString()))) {
    throw new BadRequestException('currentRaised exceeds totalValue — unsafe listing state.');
  }
}
