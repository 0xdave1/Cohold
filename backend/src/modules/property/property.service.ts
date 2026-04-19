import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyStatus } from '@prisma/client';
import { formatHighPrecision, toDecimal } from '../../common/money/decimal.util';
import { RedisService, RedisUnavailableError } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';

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

  /**
   * Safe caching boundary:
   * Property listing/detail data is safe to cache briefly (non-money source of truth).
   * Never cache wallet balances, ledger, or ownership state here.
   */
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

    const property = await this.prisma.property.create({
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        currency: dto.currency,
        totalValue,
        sharePrice,
        sharesTotal,
        minInvestment,
        status: PropertyStatus.PUBLISHED,
        sharesSold: 0,
        currentRaised: 0,
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

  async submitForReview(adminId: string, propertyId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.status !== PropertyStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT properties can be submitted for review');
    }

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
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.status !== PropertyStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT properties can be approved');
    }

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
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.status !== PropertyStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT properties can be published');
    }

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

  async listPublished(page = 1, limit = 20) {
    const cacheKey = this.keyList(page, limit);
    const cached = await this.cacheGet<{
      items: any[];
      meta: { page: number; limit: number; total: number };
    }>(cacheKey);

    if (cached) return cached;

    const skip = (page - 1) * limit;
    const where = { deletedAt: null };

    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          totalValue: true,
          sharePrice: true,
          currency: true,
          minInvestment: true,
          currentRaised: true,
          sharesTotal: true,
          sharesSold: true,
          annualYield: true,
          status: true,
          createdAt: true,
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

    const mappedItems = await Promise.all(
      items.map(async (p) => {
        const firstImage = p.images[0];
        const coverImageUrl = firstImage
          ? (await this.signedReadUrlOrNull(firstImage.storageKey)) ?? firstImage.url ?? null
          : null;

        return {
          ...p,
          images: undefined,
          coverImageUrl,
          totalValue: p.totalValue.toString(),
          sharePrice: p.sharePrice.toString(),
          fundingGoal: p.totalValue.toString(),
          fundedAmount: p.currentRaised.toString(),
          minInvestment: p.minInvestment.toString(),
          currentRaised: p.currentRaised.toString(),
          sharesTotal: p.sharesTotal.toString(),
          sharesSold: p.sharesSold.toString(),
          annualYield: p.annualYield != null ? p.annualYield.toString() : null,
        };
      }),
    );

    const result = {
      items: mappedItems,
      meta: { page, limit, total },
    };

    await this.cacheSet(cacheKey, result, 30);
    return result;
  }

  async getPublishedById(id: string) {
    const cacheKey = this.keyDetail(id);
    const cached = await this.cacheGet<any>(cacheKey);

    if (cached) return cached;

    const property = await this.prisma.property.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        totalValue: true,
        sharePrice: true,
        currency: true,
        minInvestment: true,
        currentRaised: true,
        sharesTotal: true,
        sharesSold: true,
        status: true,
        createdAt: true,
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

    const result = {
      ...property,
      images: undefined,
      coverImageUrl: property.images[0]
        ? (await this.signedReadUrlOrNull(property.images[0].storageKey)) ?? property.images[0].url ?? null
        : null,
      totalValue: property.totalValue.toString(),
      sharePrice: property.sharePrice.toString(),
      minInvestment: property.minInvestment.toString(),
      currentRaised: property.currentRaised.toString(),
      sharesTotal: property.sharesTotal.toString(),
      sharesSold: property.sharesSold.toString(),
    };

    await this.cacheSet(cacheKey, result, 30);
    return result;
  }

  async getDetails(propertyId: string) {
    const cacheKey = this.keyDetails(propertyId);
    const cached = await this.cacheGet<any>(cacheKey);

    if (cached) return cached;

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
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

    const [images, documents] = await Promise.all([
      this.buildPublicImages(property.id),
      this.buildPublicDocuments(property.id),
    ]);

    const result = {
      ...property,
      images,
      documents,
      fundingProgressPercent: formatHighPrecision(progress),
    };

    await this.cacheSet(cacheKey, result, 30);
    return result;
  }
}