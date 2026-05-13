import { PropertyService } from './property.service';
import { ListingType, Currency, PropertyStatus, TitleVerificationStatus, LegalReviewStatus } from '@prisma/client';

describe('PropertyService.createProperty', () => {
  it('persists listing type, yield, term, and legal fields on create', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'prop-1' });
    const adminLog = jest.fn().mockResolvedValue({});
    const prisma = {
      property: { create },
      adminActivityLog: { create: adminLog },
    } as any;
    const redis = { del: jest.fn(), get: jest.fn(), set: jest.fn() } as any;
    const storage = {} as any;
    const service = new PropertyService(prisma, redis, storage);

    await service.createProperty('admin-1', {
      listingType: ListingType.LAND_ACQUISITION,
      title: 'Land plot',
      description: 'x'.repeat(30),
      currency: Currency.NGN,
      totalValue: '500000',
      sharesTotal: '1',
      minInvestment: '500000',
      city: 'Abuja',
      state: 'FC',
      country: 'Nigeria',
      developerName: 'ACME',
      isListedPartnerDeveloper: true,
      annualYield: '10',
      termMonths: 36,
      yieldBasis: 'PROJECTED' as any,
      yieldIsProjected: true,
      expectedReturnDisclosure: 'Projected returns are estimates only.'.padEnd(25, ' '),
      riskDisclosure: 'You may lose some or all of your capital.'.padEnd(25, ' '),
      titleVerificationStatus: TitleVerificationStatus.PENDING,
      legalReviewStatus: LegalReviewStatus.PENDING,
      documentsAvailable: false,
      features: ['Road access', 'Drainage'],
      terms: 'Standard terms',
    });

    expect(create).toHaveBeenCalled();
    const arg = create.mock.calls[0][0];
    expect(arg.data.listingType).toBe(ListingType.LAND_ACQUISITION);
    expect(arg.data.developerName).toBe('ACME');
    expect(arg.data.isListedPartnerDeveloper).toBe(true);
    expect(arg.data.termMonths).toBe(36);
    expect(arg.data.titleVerificationStatus).toBe(TitleVerificationStatus.PENDING);
    expect(arg.data.legalReviewStatus).toBe(LegalReviewStatus.PENDING);
    expect(arg.data.status).toBe(PropertyStatus.DRAFT);
  });
});
