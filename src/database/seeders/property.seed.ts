import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

const PLACEHOLDER = 'https://cdn.brisk.ie/assets/placeholders';

const PROVIDERS = [
  {
    name: 'Dublin City Council',
    serviceType: 'bins',
    serviceLabel: 'Bins',
    description: 'Household waste collection',
    logoUrl: `${PLACEHOLDER}/providers/dublin-city-council.png`,
    iconUrl: `${PLACEHOLDER}/icons/bins.png`,
    displayOrder: 1,
  },
  {
    name: 'Electric Ireland',
    serviceType: 'electricity',
    serviceLabel: 'Electricity',
    description: 'Electricity supply',
    logoUrl: `${PLACEHOLDER}/providers/electric-ireland.png`,
    iconUrl: `${PLACEHOLDER}/icons/electricity.png`,
    displayOrder: 2,
  },
  {
    name: 'Bord Gáis Energy',
    serviceType: 'gas',
    serviceLabel: 'GAS',
    description: 'Gas supply',
    logoUrl: `${PLACEHOLDER}/providers/bord-gais.png`,
    iconUrl: `${PLACEHOLDER}/icons/gas.png`,
    displayOrder: 3,
  },
  {
    name: 'Aviva',
    serviceType: 'insurance',
    serviceLabel: 'Home Insurance',
    description: 'Building & Contents cover',
    logoUrl: `${PLACEHOLDER}/providers/aviva.png`,
    iconUrl: `${PLACEHOLDER}/icons/insurance.png`,
    displayOrder: 4,
  },
];

export async function seedPropertyModule(prisma: PrismaClient): Promise<void> {
  for (const provider of PROVIDERS) {
    const existing = await prisma.utilityProvider.findFirst({
      where: { name: provider.name, serviceType: provider.serviceType },
    });
    if (existing) {
      await prisma.utilityProvider.update({
        where: { id: existing.id },
        data: {
          serviceLabel: provider.serviceLabel,
          description: provider.description,
          logoUrl: provider.logoUrl,
          iconUrl: provider.iconUrl,
          displayOrder: provider.displayOrder,
          isActive: true,
        },
      });
    } else {
      await prisma.utilityProvider.create({ data: provider });
    }
  }

  const customer =
    (await prisma.user.findFirst({ where: { email: 'sarah.murphy@example.com' } })) ||
    (await prisma.user.findFirst({ where: { role: 'CUSTOMER' } }));

  if (!customer) {
    logger.info('⚠️ No customer found — skipped property demo addresses.');
    return;
  }

  const existingAddress = await prisma.address.findFirst({ where: { userId: customer.id } });
  if (existingAddress) {
    logger.info('✅ Property demo data already present for customer.');
    return;
  }

  const home = await prisma.address.create({
    data: {
      userId: customer.id,
      addressType: 'Home',
      label: 'Home',
      houseNumber: '14',
      addressLine1: 'Oak Street',
      addressLine2: 'Ranelagh',
      city: 'Dublin',
      county: 'Dublin 6',
      eircode: 'D06 XY12',
      country: 'Ireland',
      mprnNumber: '12345678901',
      gprnNumber: '12356787',
      utnNumber: '012345678',
      latitude: 53.325,
      longitude: -6.254,
      mapImageUrl: `${PLACEHOLDER}/maps/home-ranelagh.png`,
      isDefault: true,
    },
  });

  const work = await prisma.address.create({
    data: {
      userId: customer.id,
      addressType: 'Work',
      label: 'Work',
      houseNumber: '3',
      addressLine1: 'Grand Canal Dock',
      city: 'Dublin',
      county: 'Dublin 2',
      eircode: 'D02 AB34',
      country: 'Ireland',
      mprnNumber: '10987654321',
      gprnNumber: '87654321',
      latitude: 53.341,
      longitude: -6.239,
      mapImageUrl: `${PLACEHOLDER}/maps/work-grand-canal.png`,
      isDefault: false,
    },
  });

  const homeProperty = await prisma.property.create({
    data: {
      userId: customer.id,
      addressId: home.id,
      propertyName: 'Home',
      addressLine1: '14 Oak Street',
      addressLine2: 'Ranelagh',
      city: 'Dublin',
      county: 'Dublin 6',
      eircode: 'D06 XY12',
      country: 'Ireland',
    },
  });

  await prisma.property.create({
    data: {
      userId: customer.id,
      addressId: work.id,
      propertyName: 'Work',
      addressLine1: '3 Grand Canal Dock',
      city: 'Dublin',
      county: 'Dublin 2',
      eircode: 'D02 AB34',
      country: 'Ireland',
    },
  });

  const elec = await prisma.meter.create({
    data: {
      propertyId: homeProperty.id,
      meterType: 'electricity',
      mprnGprn: '12345678901',
      unitLabel: 'kWh',
    },
  });
  const gas = await prisma.meter.create({
    data: {
      propertyId: homeProperty.id,
      meterType: 'gas',
      mprnGprn: '12356787',
      unitLabel: 'm³',
    },
  });

  await prisma.meterReading.createMany({
    data: [
      {
        meterId: elec.id,
        userId: customer.id,
        readingValue: 12340,
        readingDate: new Date('2026-07-01T10:00:00.000Z'),
        status: 'accepted',
      },
      {
        meterId: gas.id,
        userId: customer.id,
        readingValue: 9820,
        readingDate: new Date('2026-07-01T10:00:00.000Z'),
        status: 'accepted',
      },
    ],
  });

  const providers = await prisma.utilityProvider.findMany({
    where: { serviceType: { in: ['bins', 'electricity', 'gas'] } },
  });
  await prisma.subscription.createMany({
    data: providers.map((provider) => ({
      propertyId: homeProperty.id,
      utilityProviderId: provider.id,
      serviceType: provider.serviceType,
      status: 'active',
    })),
  });

  logger.info('✅ Property module seeded (providers + Sarah Home/Work demo data).');
}
