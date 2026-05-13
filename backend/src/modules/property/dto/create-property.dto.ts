import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  Currency,
  LegalReviewStatus,
  ListingType,
  PropertyYieldBasis,
  TitleVerificationStatus,
} from '@prisma/client';

const MAX_FEATURES = 50;
const MAX_FEATURE_ITEM = 200;
const MAX_DISCLOSURE = 8000;
const MAX_TERMS = 50000;
const MAX_DEVELOPER = 200;

export class CreatePropertyDto {
  @IsOptional()
  @IsEnum(ListingType)
  listingType?: ListingType;

  @IsString()
  @MaxLength(300)
  title!: string;

  @IsString()
  @MaxLength(20000)
  description!: string;

  /** Legacy single-line location (optional if structured address is complete). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_DEVELOPER)
  developerName?: string;

  @IsOptional()
  @IsBoolean()
  isListedPartnerDeveloper?: boolean;

  @IsEnum(Currency)
  currency!: Currency;

  @IsNumberString()
  totalValue!: string;

  @IsNumberString()
  sharesTotal!: string;

  @IsNumberString()
  minInvestment!: string;

  @IsOptional()
  @IsNumberString()
  sharePrice?: string;

  /**
   * Unitless annual rate (e.g. 0.125) or percent 0–100 (e.g. "12.5" meaning 12.5%).
   * Parsed in service; persisted as unitless Decimal.
   */
  @IsOptional()
  @IsNumberString()
  annualYield?: string;

  @IsOptional()
  @IsBoolean()
  yieldIsProjected?: boolean;

  @IsOptional()
  @IsEnum(PropertyYieldBasis)
  yieldBasis?: PropertyYieldBasis;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  termMonths?: number;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_DISCLOSURE)
  expectedReturnDisclosure?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_DISCLOSURE)
  riskDisclosure?: string;

  @IsOptional()
  @IsEnum(TitleVerificationStatus)
  titleVerificationStatus?: TitleVerificationStatus;

  @IsOptional()
  @IsEnum(LegalReviewStatus)
  legalReviewStatus?: LegalReviewStatus;

  @IsOptional()
  @IsBoolean()
  documentsAvailable?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FEATURES)
  @IsString({ each: true })
  @MaxLength(MAX_FEATURE_ITEM, { each: true })
  features?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(MAX_TERMS)
  terms?: string;

  /** @deprecated Ignored — use listingType */
  @IsOptional()
  @IsString()
  type?: string;
}
