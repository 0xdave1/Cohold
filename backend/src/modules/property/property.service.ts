import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyStatus } from '@prisma/client';
import { formatHighPrecision, toDecimal } from '../../common/money/decimal.util';

@Injectable()
export class PropertyService {
  constructor(private readonly prisma: PrismaService) {}

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

    return updated;
  }

  /** List all properties (no approval filter). Returns all non-deleted for user investment listing. */
  async listPublished(page = 1, limit = 20) {
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
        },
      }),
      this.prisma.property.count({ where }),
    ]);
    return {
      items: items.map((p) => ({
        ...p,
        totalValue: p.totalValue.toString(),
        sharePrice: p.sharePrice.toString(),
        fundingGoal: p.totalValue.toString(),
        fundedAmount: p.currentRaised.toString(),
        minInvestment: p.minInvestment.toString(),
        currentRaised: p.currentRaised.toString(),
        sharesTotal: p.sharesTotal.toString(),
        sharesSold: p.sharesSold.toString(),
        annualYield: p.annualYield != null ? p.annualYield.toString() : null,
      })),
      meta: { page, limit, total },
    };
  }

  /** Get a single property by id (for user-facing listing detail). No approval filter. */
  async getPublishedById(id: string) {
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
      },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    return {
      ...property,
      totalValue: property.totalValue.toString(),
      sharePrice: property.sharePrice.toString(),
      minInvestment: property.minInvestment.toString(),
      currentRaised: property.currentRaised.toString(),
      sharesTotal: property.sharesTotal.toString(),
      sharesSold: property.sharesSold.toString(),
    };
  }

  async getDetails(propertyId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        investments: true,
        documents: true,
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

    return {
      ...property,
      fundingProgressPercent: formatHighPrecision(progress),
    };
  }
}

