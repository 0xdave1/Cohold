import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { DistributionStatus, InvestmentStatus, ListingType, PropertyStatus } from '@prisma/client';
import { formatHighPrecision, toDecimal } from '../../common/money/decimal.util';
import { RedisService, RedisUnavailableError } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { assertPropertyPublishableOrThrow } from './property-publish-rules';
import { featuresToPrismaJson, parseAnnualYieldToStoredUnitless, parseFeaturesFromDb } from './property-yield.util';

const publishedWhere = {
  deletedAt: null,
  status: PropertyStatus.PUBLISHED,
} as const;

@Injectable()
export class PropertyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
  ) {}

  private async signedReadUrlOrNull(key: string | null | undefined): Promise<string | null> {
    if (!key) return null;
    return this.storage.createSignedReadUrl(key, 300).catch(() => null);
  }

  private async buildPublicImages(propertyId: string) {
    const images = await this.prisma.propertyImage.findMany({
      where: { propertyId },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        storageKey: true,
        url: true,
        altText: true,
        position: true,
      },
    });

    return Promise.all(
      images.map(async (img) => ({
        id: img.id,
        url: (await this.signedReadUrlOrNull(img.storageKey)) ?? img.url ?? '',
        altText: img.altText ?? null,
        position: img.position,
      })),
    );
  }

  private async buildPublicDocuments(propertyId: string) {
    const docs = await this.prisma.propertyDocument.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        s3Key: true,
      },
    });

    const mapped = await Promise.all(
      docs.map(async (doc) => ({
        id: doc.id,
        type: doc.type,
        url: await this.signedReadUrlOrNull(doc.s3Key),
      })),
    );

    return mapped.filter((d) => Boolean(d.url)) as Array<{ id: string; type: string; url: string }>;
  }

  private keyList(page: number, limit: number) {
    return `properties:list:${page}:${limit}`;
  }

  private keyDetail(id: string) {
    return `properties:detail:${id}`;
  }

  private keyDetails(id: string) {
    return `properties:details:${id}`;
  }

  private async cacheGet<T>(key: string): Promise<T | null> {
    try {
      return await this.redis.get<T>(key);
    } catch (error) {
      if (error instanceof RedisUnavailableError) return null;
      throw error;
    }
  }

  private async cacheSet(key: string, value: unknown, ttlSeconds = 30): Promise<void> {
    try {
      await this.redis.set(key, value as any, { ttlSeconds });
    } catch (error) {
      if (error instanceof RedisUnavailableError) return;
      throw error;
    }
  }

  private async cacheDel(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      if (error instanceof RedisUnavailableError) return;
      throw error;
    }
  }

  private async bustPropertyCaches(propertyId?: string) {
    const tasks: Promise<void>[] = [];

    if (propertyId) {
      tasks.push(this.cacheDel(this.keyDetail(propertyId)));
      tasks.push(this.cacheDel(this.keyDetails(propertyId)));
    }

    for (const page of [1, 2, 3]) {
      tasks.push(this.cacheDel(this.keyList(page, 20)));
    }

    await Promise.all(tasks);
  }

  private resolveLocationLineFromParts(
    location?: string | null,
    address?: string | null,
    city?: string | null,
    state?: string | null,
    country?: string | null,
  ): string {
    const fromLoc = location?.trim();
    if (fromLoc) return fromLoc;
    const parts = [address, city, state, country]
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean);
    return parts.join(', ');
  }

  async createProperty(adminId: string, dto: CreatePropertyDto) {
    const totalValue = toDecimal(dto.totalValue);
    const sharesTotal = toDecimal(dto.sharesTotal);
    const minInvestment = toDecimal(dto.minInvestment);

    if (totalValue.lte(0) || sharesTotal.lte(0) || minInvestment.lte(0)) {
      throw new BadRequestException('Monetary fields must be positive');
    }

    const sharePrice = dto.sharePrice
      ? toDecimal(dto.sharePrice)
      : totalValue.div(sharesTotal);

    if (sharePrice.lte(0)) {
      throw new BadRequestException('Share price must be positive');
    }

    const annualYield = parseAnnualYieldToStoredUnitless(dto.annualYield);
    const features = featuresToPrismaJson(dto.features);
    const locationLine = this.resolveLocationLineFromParts(
      dto.location,
      dto.address,
      dto.city,
      dto.state,
      dto.country,
    );
    if (!locationLine || locationLine.length < 2) {
      throw new BadRequestException('Provide location or structured address (city/state/country).');
    }

    const property = await this.prisma.property.create({
      data: {
        listingType: dto.listingType ?? ListingType.FRACTIONAL_OWNERSHIP,
        title: dto.title,
        description: dto.description,
        location: locationLine,
        address: (dto.address ?? '').trim(),
        city: (dto.city ?? '').trim(),
        state: (dto.state ?? '').trim(),
        country: (dto.country ?? '').trim(),
        developerName: dto.developerName?.trim() || null,
        isListedPartnerDeveloper: dto.isListedPartnerDeveloper ?? false,
        currency: dto.currency,
        totalValue,
        sharePrice,
        sharesTotal,
        minInvestment,
        status: PropertyStatus.DRAFT,
        sharesSold: 0,
        currentRaised: 0,
        annualYield,
        yieldIsProjected: dto.yieldIsProjected ?? true,
        yieldBasis: dto.yieldBasis,
        termMonths: dto.termMonths ?? null,
        expectedReturnDisclosure: dto.expectedReturnDisclosure?.trim() || null,
        riskDisclosure: dto.riskDisclosure?.trim() || null,
        titleVerificationStatus: dto.titleVerificationStatus,
        legalReviewStatus: dto.legalReviewStatus,
        documentsAvailable: dto.documentsAvailable ?? false,
        features: features as unknown as Prisma.InputJsonValue,
        terms: dto.terms?.trim() || null,
      },
    });

    await this.prisma.adminActivityLog.create({
      data: {
        adminId,
        action: 'PROPERTY_CREATE',
        entityType: 'Property',
        entityId: property.id,
      },
    });

    await this.bustPropertyCaches(property.id);
    return property;
  }

  async updateProperty(adminId: string, propertyId: string, dto: UpdatePropertyDto) {
    const existing = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Property not found');

    const data: Prisma.PropertyUpdateInput = {};

    if (dto.listingType !== undefined) data.listingType = dto.listingType;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.address !== undefined) data.address = dto.address.trim();
    if (dto.city !== undefined) data.city = dto.city.trim();
    if (dto.state !== undefined) data.state = dto.state.trim();
    if (dto.country !== undefined) data.country = dto.country.trim();
    if (dto.developerName !== undefined) data.developerName = dto.developerName?.trim() || null;
    if (dto.isListedPartnerDeveloper !== undefined) data.isListedPartnerDeveloper = dto.isListedPartnerDeveloper;
    if (dto.currency !== undefined) data.currency = dto.currency;

    if (dto.totalValue !== undefined) data.totalValue = toDecimal(dto.totalValue);
    if (dto.sharesTotal !== undefined) data.sharesTotal = toDecimal(dto.sharesTotal);
    if (dto.minInvestment !== undefined) data.minInvestment = toDecimal(dto.minInvestment);
    if (dto.sharePrice !== undefined) {
      if (dto.sharePrice?.trim()) {
        data.sharePrice = toDecimal(dto.sharePrice);
      }
    }

    if (dto.annualYield !== undefined) {
      data.annualYield = parseAnnualYieldToStoredUnitless(dto.annualYield);
    }
    if (dto.yieldIsProjected !== undefined) data.yieldIsProjected = dto.yieldIsProjected;
    if (dto.yieldBasis !== undefined) data.yieldBasis = dto.yieldBasis;
    if (dto.termMonths !== undefined) data.termMonths = dto.termMonths;
    if (dto.expectedReturnDisclosure !== undefined) {
      data.expectedReturnDisclosure = dto.expectedReturnDisclosure?.trim() || null;
    }
    if (dto.riskDisclosure !== undefined) data.riskDisclosure = dto.riskDisclosure?.trim() || null;
    if (dto.titleVerificationStatus !== undefined) data.titleVerificationStatus = dto.titleVerificationStatus;
    if (dto.legalReviewStatus !== undefined) data.legalReviewStatus = dto.legalReviewStatus;
    if (dto.documentsAvailable !== undefined) data.documentsAvailable = dto.documentsAvailable;
    if (dto.features !== undefined) {
      data.features = featuresToPrismaJson(dto.features) as unknown as Prisma.InputJsonValue;
    }
    if (dto.terms !== undefined) data.terms = dto.terms?.trim() || null;

    if (
      dto.location !== undefined ||
      dto.address !== undefined ||
      dto.city !== undefined ||
      dto.state !== undefined ||
      dto.country !== undefined
    ) {
      const merged = this.resolveLocationLineFromParts(
        dto.location ?? existing.location,
        dto.address ?? existing.address,
        dto.city ?? existing.city,
        dto.state ?? existing.state,
        dto.country ?? existing.country,
      );
      if (merged.length >= 2) data.location = merged;
    }

    const updated = await this.prisma.property.update({
      where: { id: propertyId },
      data,
    });

    await this.prisma.adminActivityLog.create({
      data: {
        adminId,
        action: 'PROPERTY_UPDATE',
        entityType: 'Property',
        entityId: propertyId,
      },
    });

    await this.bustPropertyCaches(propertyId);
    return updated;
  }

  private async loadPublishShape(propertyId: string) {
    return this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      include: { _count: { select: { images: true, documents: true } } },
    });
  }

  async submitForReview(adminId: string, propertyId: string) {
    const property = await this.loadPublishShape(propertyId);

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.status !== PropertyStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT properties can be submitted for review');
    }

    assertPropertyPublishableOrThrow(property);

    const updated = await this.prisma.property.update({
      where: { id: propertyId },
      data: { status: PropertyStatus.PUBLISHED },
    });

    await this.prisma.adminActivityLog.create({
      data: {
        adminId,
        action: 'PROPERTY_SUBMIT_REVIEW',
        entityType: 'Property',
        entityId: propertyId,
      },
    });

    await this.bustPropertyCaches(propertyId);
    return updated;
  }

  async approve(adminId: string, propertyId: string) {
    const property = await this.loadPublishShape(propertyId);

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.status !== PropertyStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT properties can be approved');
    }

    assertPropertyPublishableOrThrow(property);

    const updated = await this.prisma.property.update({
      where: { id: propertyId },
      data: { status: PropertyStatus.PUBLISHED },
    });

    await this.prisma.adminActivityLog.create({
      data: {
        adminId,
        action: 'PROPERTY_APPROVE',
        entityType: 'Property',
        entityId: propertyId,
      },
    });

    await this.bustPropertyCaches(propertyId);
    return updated;
  }

  async publish(adminId: string, propertyId: string) {
    const property = await this.loadPublishShape(propertyId);

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.status !== PropertyStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT properties can be published');
    }

    assertPropertyPublishableOrThrow(property);

    const updated = await this.prisma.property.update({
      where: { id: propertyId },
      data: { status: PropertyStatus.PUBLISHED },
    });

    await this.prisma.adminActivityLog.create({
      data: {
        adminId,
        action: 'PROPERTY_PUBLISH',
        entityType: 'Property',
        entityId: propertyId,
      },
    });

    await this.bustPropertyCaches(propertyId);
    return updated;
  }

  private mapCorePublicFields(p: {
    id: string;
    listingType: string;
    title: string;
    description: string;
    location: string;
    address: string;
    city: string;
    state: string;
    country: string;
    developerName: string | null;
    isListedPartnerDeveloper: boolean;
    totalValue: { toString(): string };
    sharePrice: { toString(): string };
    currency: string;
    minInvestment: { toString(): string };
    currentRaised: { toString(): string };
    sharesTotal: { toString(): string };
    sharesSold: { toString(): string };
    annualYield: { toString(): string } | null;
    yieldIsProjected: boolean;
    yieldBasis: string;
    termMonths: number | null;
    expectedReturnDisclosure: string | null;
    riskDisclosure: string | null;
    titleVerificationStatus: string;
    legalReviewStatus: string;
    documentsAvailable: boolean;
    features: unknown;
    terms: string | null;
    status: string;
    createdAt: Date;
    investorCount?: number;
  }) {
    const totalShares = toDecimal(p.sharesTotal.toString());
    const soldShares = toDecimal(p.sharesSold.toString());
    const available = totalShares.minus(soldShares);
    const progress = totalShares.gt(0) ? soldShares.div(totalShares).mul(100) : toDecimal(0);
    const displayLocation = [p.city, p.state, p.country].map((x) => x.trim()).filter(Boolean).join(', ') || p.location;
    const ay = p.annualYield != null ? p.annualYield.toString() : null;

    return {
      id: p.id,
      listingType: p.listingType,
      title: p.title,
      description: p.description,
      location: p.location,
      displayLocation,
      address: p.address,
      city: p.city,
      state: p.state,
      country: p.country,
      developerName: p.developerName,
      isListedPartnerDeveloper: p.isListedPartnerDeveloper,
      totalValue: p.totalValue.toString(),
      sharePrice: p.sharePrice.toString(),
      currency: p.currency,
      minInvestment: p.minInvestment.toString(),
      currentRaised: p.currentRaised.toString(),
      sharesTotal: p.sharesTotal.toString(),
      sharesSold: p.sharesSold.toString(),
      availableShares: formatHighPrecision(available),
      fundingProgressPercent: formatHighPrecision(progress),
      annualYield: ay,
      projectedAnnualYield: ay,
      yieldIsProjected: p.yieldIsProjected,
      yieldBasis: p.yieldBasis,
      termMonths: p.termMonths,
      expectedReturnDisclosure: p.expectedReturnDisclosure,
      riskDisclosure: p.riskDisclosure,
      titleVerificationStatus: p.titleVerificationStatus,
      legalReviewStatus: p.legalReviewStatus,
      documentsAvailable: p.documentsAvailable,
      features: parseFeaturesFromDb(p.features),
      terms: p.terms,
      status: p.status,
      createdAt: p.createdAt,
      fundingGoal: p.totalValue.toString(),
      fundedAmount: p.currentRaised.toString(),
      investorCount: p.investorCount ?? 0,
    };
  }

  async listPublished(page = 1, limit = 20) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.floor(limit)) : 20;
    const cacheKey = this.keyList(safePage, safeLimit);
    const cached = await this.cacheGet<{
      items: any[];
      meta: { page: number; limit: number; total: number };
    }>(cacheKey);

    if (cached) return cached;

    const skip = (safePage - 1) * safeLimit;
    const where = { ...publishedWhere };

    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          listingType: true,
          title: true,
          description: true,
          location: true,
          address: true,
          city: true,
          state: true,
          country: true,
          developerName: true,
          isListedPartnerDeveloper: true,
          totalValue: true,
          sharePrice: true,
          currency: true,
          minInvestment: true,
          currentRaised: true,
          sharesTotal: true,
          sharesSold: true,
          annualYield: true,
          yieldIsProjected: true,
          yieldBasis: true,
          termMonths: true,
          expectedReturnDisclosure: true,
          riskDisclosure: true,
          titleVerificationStatus: true,
          legalReviewStatus: true,
          documentsAvailable: true,
          features: true,
          terms: true,
          status: true,
          createdAt: true,
          _count: { select: { documents: true, investments: true } },
          images: {
            orderBy: { position: 'asc' },
            take: 1,
            select: {
              storageKey: true,
              url: true,
            },
          },
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    const propertyIds = items.map((p) => p.id);
    const distinctInvestorRows =
      propertyIds.length > 0
        ? await this.prisma.investment.groupBy({
            by: ['propertyId', 'userId'],
            where: { propertyId: { in: propertyIds }, status: InvestmentStatus.ACTIVE },
          })
        : [];
    const investorCountByProperty = new Map<string, number>();
    for (const row of distinctInvestorRows) {
      investorCountByProperty.set(
        row.propertyId,
        (investorCountByProperty.get(row.propertyId) ?? 0) + 1,
      );
    }

    const mappedItems = await Promise.all(
      items.map(async (p) => {
        const firstImage = p.images[0];
        const coverImageUrl = firstImage
          ? (await this.signedReadUrlOrNull(firstImage.storageKey)) ?? firstImage.url ?? null
          : null;

        const { _count, images, ...row } = p;
        const docsAvailable = row.documentsAvailable || _count.documents > 0;
        const investorCount = investorCountByProperty.get(p.id) ?? 0;
        const core = this.mapCorePublicFields({
          ...row,
          documentsAvailable: docsAvailable,
          investorCount,
        });
        return {
          ...core,
          coverImageUrl,
        };
      }),
    );

    const result = {
      items: mappedItems,
      meta: { page: safePage, limit: safeLimit, total },
    };

    await this.cacheSet(cacheKey, result, 30);
    return result;
  }

  async getPublishedById(id: string) {
    const cacheKey = this.keyDetail(id);
    const cached = await this.cacheGet<any>(cacheKey);

    if (cached) return cached;

    const property = await this.prisma.property.findFirst({
      where: { id, ...publishedWhere },
      select: {
        id: true,
        listingType: true,
        title: true,
        description: true,
        location: true,
        address: true,
        city: true,
        state: true,
        country: true,
        developerName: true,
        isListedPartnerDeveloper: true,
        totalValue: true,
        sharePrice: true,
        currency: true,
        minInvestment: true,
        currentRaised: true,
        sharesTotal: true,
        sharesSold: true,
        annualYield: true,
        yieldIsProjected: true,
        yieldBasis: true,
        termMonths: true,
        expectedReturnDisclosure: true,
        riskDisclosure: true,
        titleVerificationStatus: true,
        legalReviewStatus: true,
        documentsAvailable: true,
        features: true,
        terms: true,
        status: true,
        createdAt: true,
        _count: { select: { documents: true } },
        images: {
          orderBy: { position: 'asc' },
          take: 1,
          select: {
            storageKey: true,
            url: true,
          },
        },
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const investorRows = await this.prisma.investment.groupBy({
      by: ['userId'],
      where: { propertyId: id, status: InvestmentStatus.ACTIVE },
    });

    const coverImageUrl = property.images[0]
      ? (await this.signedReadUrlOrNull(property.images[0].storageKey)) ?? property.images[0].url ?? null
      : null;

    const { images, _count, ...row } = property;
    const docsAvailable = row.documentsAvailable || _count.documents > 0;
    const result = {
      ...this.mapCorePublicFields({
        ...row,
        documentsAvailable: docsAvailable,
        investorCount: investorRows.length,
      }),
      coverImageUrl,
    };

    await this.cacheSet(cacheKey, result, 30);
    return result;
  }

  async getDetails(propertyId: string) {
    const cacheKey = this.keyDetails(propertyId);
    const cached = await this.cacheGet<any>(cacheKey);

    if (cached) return cached;

    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, ...publishedWhere },
      include: {
        investments: true,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const totalShares = toDecimal(property.sharesTotal.toString());
    const soldShares = toDecimal(property.sharesSold.toString());
    const progress = totalShares.gt(0)
      ? soldShares.div(totalShares).mul(100)
      : toDecimal(0);

    const [images, documents, histAgg, payoutAgg] = await Promise.all([
      this.buildPublicImages(property.id),
      this.buildPublicDocuments(property.id),
      this.prisma.distribution.aggregate({
        where: { propertyId, status: DistributionStatus.COMPLETED },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      this.prisma.distributionPayout.aggregate({
        where: { distribution: { propertyId, status: DistributionStatus.COMPLETED } },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    const {
      investments,
      annualYield: _ay,
      totalValue,
      sharePrice,
      minInvestment,
      currentRaised,
      sharesTotal,
      sharesSold,
      ...rest
    } = property;

    const investorCount = new Set(
      investments.filter((i) => i.status === InvestmentStatus.ACTIVE).map((i) => i.userId),
    ).size;

    const core = this.mapCorePublicFields({
      ...rest,
      annualYield: property.annualYield,
      totalValue: property.totalValue,
      sharePrice: property.sharePrice,
      minInvestment: property.minInvestment,
      currentRaised: property.currentRaised,
      sharesTotal: property.sharesTotal,
      sharesSold: property.sharesSold,
      documentsAvailable: property.documentsAvailable || documents.length > 0,
      investorCount,
    });

    const result = {
      ...core,
      totalValue: totalValue.toString(),
      sharePrice: sharePrice.toString(),
      minInvestment: minInvestment.toString(),
      currentRaised: currentRaised.toString(),
      sharesTotal: sharesTotal.toString(),
      sharesSold: sharesSold.toString(),
      images,
      documents,
      investments: investments.map((i) => ({ userId: i.userId, amount: i.amount.toString() })),
      fundingProgressPercent: formatHighPrecision(progress),
      historicalDistributionSummary: {
        completedDistributionCount: histAgg._count.id,
        totalGrossDistributedAmount: histAgg._sum.totalAmount?.toString() ?? '0',
        investorPayoutLineCount: payoutAgg._count.id,
        totalInvestorPayoutAmount: payoutAgg._sum.amount?.toString() ?? '0',
        note:
          'Historical totals from completed admin distributions and credited payout lines; not a forecast of future returns.',
      },
    };

    await this.cacheSet(cacheKey, result, 30);
    return result;
  }
}
