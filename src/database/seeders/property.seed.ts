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
  {
    name: 'Eir Broadband',
    serviceType: 'broadband',
    serviceLabel: 'Broadband',
    description: 'High-speed fibre broadband and Wi-Fi',
    logoUrl: `${PLACEHOLDER}/providers/eir.png`,
    iconUrl: `${PLACEHOLDER}/icons/broadband.png`,
    displayOrder: 5,
  },
  {
    name: 'Virgin Media',
    serviceType: 'broadband',
    serviceLabel: 'Broadband',
    description: 'Ultrafast broadband & digital TV',
    logoUrl: `${PLACEHOLDER}/providers/virgin-media.png`,
    iconUrl: `${PLACEHOLDER}/icons/broadband.png`,
    displayOrder: 6,
  },
  {
    name: 'Vodafone Broadband',
    serviceType: 'broadband',
    serviceLabel: 'Broadband',
    description: 'Home fibre broadband',
    logoUrl: `${PLACEHOLDER}/providers/vodafone.png`,
    iconUrl: `${PLACEHOLDER}/icons/broadband.png`,
    displayOrder: 7,
  },
  {
    name: 'SSE Airtricity',
    serviceType: 'electricity',
    serviceLabel: 'Electricity',
    description: '100% green electricity supply',
    logoUrl: `${PLACEHOLDER}/providers/sse-airtricity.png`,
    iconUrl: `${PLACEHOLDER}/icons/electricity.png`,
    displayOrder: 8,
  },
  {
    name: 'SSE Airtricity',
    serviceType: 'gas',
    serviceLabel: 'GAS',
    description: 'Natural gas supply',
    logoUrl: `${PLACEHOLDER}/providers/sse-airtricity.png`,
    iconUrl: `${PLACEHOLDER}/icons/gas.png`,
    displayOrder: 9,
  },
  {
    name: 'Energia',
    serviceType: 'electricity',
    serviceLabel: 'Electricity',
    description: 'Dual fuel and green electricity',
    logoUrl: `${PLACEHOLDER}/providers/energia.png`,
    iconUrl: `${PLACEHOLDER}/icons/electricity.png`,
    displayOrder: 10,
  },
  {
    name: 'Energia',
    serviceType: 'gas',
    serviceLabel: 'GAS',
    description: 'Domestic natural gas supply',
    logoUrl: `${PLACEHOLDER}/providers/energia.png`,
    iconUrl: `${PLACEHOLDER}/icons/gas.png`,
    displayOrder: 11,
  },
  {
    name: 'Flogas',
    serviceType: 'electricity',
    serviceLabel: 'Electricity',
    description: 'Residential electricity plans',
    logoUrl: `${PLACEHOLDER}/providers/flogas.png`,
    iconUrl: `${PLACEHOLDER}/icons/electricity.png`,
    displayOrder: 12,
  },
  {
    name: 'Flogas',
    serviceType: 'gas',
    serviceLabel: 'GAS',
    description: 'LPG and natural gas supply',
    logoUrl: `${PLACEHOLDER}/providers/flogas.png`,
    iconUrl: `${PLACEHOLDER}/icons/gas.png`,
    displayOrder: 13,
  },
  {
    name: 'PrePayPower',
    serviceType: 'electricity',
    serviceLabel: 'Electricity',
    description: 'Pay As You Go electricity',
    logoUrl: `${PLACEHOLDER}/providers/prepaypower.png`,
    iconUrl: `${PLACEHOLDER}/icons/electricity.png`,
    displayOrder: 14,
  },
  {
    name: 'PrePayPower',
    serviceType: 'gas',
    serviceLabel: 'GAS',
    description: 'Pay As You Go gas',
    logoUrl: `${PLACEHOLDER}/providers/prepaypower.png`,
    iconUrl: `${PLACEHOLDER}/icons/gas.png`,
    displayOrder: 15,
  },
  {
    name: 'Yuno Energy',
    serviceType: 'electricity',
    serviceLabel: 'Electricity',
    description: 'Smart electricity plans',
    logoUrl: `${PLACEHOLDER}/providers/yuno-energy.png`,
    iconUrl: `${PLACEHOLDER}/icons/electricity.png`,
    displayOrder: 16,
  },
  {
    name: 'Pinergy',
    serviceType: 'electricity',
    serviceLabel: 'Electricity',
    description: 'Smart energy and electricity',
    logoUrl: `${PLACEHOLDER}/providers/pinergy.png`,
    iconUrl: `${PLACEHOLDER}/icons/electricity.png`,
    displayOrder: 17,
  },
  {
    name: 'Sky Ireland',
    serviceType: 'broadband',
    serviceLabel: 'Broadband',
    description: 'Ultrafast fibre broadband',
    logoUrl: `${PLACEHOLDER}/providers/sky.png`,
    iconUrl: `${PLACEHOLDER}/icons/broadband.png`,
    displayOrder: 18,
  },
  {
    name: 'Pure Telecom',
    serviceType: 'broadband',
    serviceLabel: 'Broadband',
    description: 'Fibre broadband for homes',
    logoUrl: `${PLACEHOLDER}/providers/pure-telecom.png`,
    iconUrl: `${PLACEHOLDER}/icons/broadband.png`,
    displayOrder: 19,
  },
  {
    name: 'Digiweb',
    serviceType: 'broadband',
    serviceLabel: 'Broadband',
    description: 'High-speed fibre & rural broadband',
    logoUrl: `${PLACEHOLDER}/providers/digiweb.png`,
    iconUrl: `${PLACEHOLDER}/icons/broadband.png`,
    displayOrder: 20,
  },
  {
    name: 'Three Ireland',
    serviceType: 'broadband',
    serviceLabel: 'Broadband',
    description: '5G and fibre home broadband',
    logoUrl: `${PLACEHOLDER}/providers/three.png`,
    iconUrl: `${PLACEHOLDER}/icons/broadband.png`,
    displayOrder: 21,
  },
  {
    name: 'Imagine',
    serviceType: 'broadband',
    serviceLabel: 'Broadband',
    description: 'Fibre and 5G rural broadband',
    logoUrl: `${PLACEHOLDER}/providers/imagine.png`,
    iconUrl: `${PLACEHOLDER}/icons/broadband.png`,
    displayOrder: 22,
  },
  {
    name: 'Panda',
    serviceType: 'bins',
    serviceLabel: 'Bins',
    description: 'Domestic waste and recycling collection',
    logoUrl: `${PLACEHOLDER}/providers/panda.png`,
    iconUrl: `${PLACEHOLDER}/icons/bins.png`,
    displayOrder: 23,
  },
  {
    name: 'Oxigen Environmental',
    serviceType: 'bins',
    serviceLabel: 'Bins',
    description: 'Household wheelie bin collection',
    logoUrl: `${PLACEHOLDER}/providers/oxigen.png`,
    iconUrl: `${PLACEHOLDER}/icons/bins.png`,
    displayOrder: 24,
  },
  {
    name: 'The City Bin Co.',
    serviceType: 'bins',
    serviceLabel: 'Bins',
    description: 'Award-winning waste and recycling service',
    logoUrl: `${PLACEHOLDER}/providers/city-bin.png`,
    iconUrl: `${PLACEHOLDER}/icons/bins.png`,
    displayOrder: 25,
  },
  {
    name: 'Thorntons Recycling',
    serviceType: 'bins',
    serviceLabel: 'Bins',
    description: 'Residential bin collection & skip hire',
    logoUrl: `${PLACEHOLDER}/providers/thorntons.png`,
    iconUrl: `${PLACEHOLDER}/icons/bins.png`,
    displayOrder: 26,
  },
  {
    name: 'Greyhound Recycling',
    serviceType: 'bins',
    serviceLabel: 'Bins',
    description: 'Household bin collections',
    logoUrl: `${PLACEHOLDER}/providers/greyhound.png`,
    iconUrl: `${PLACEHOLDER}/icons/bins.png`,
    displayOrder: 27,
  },
  {
    name: 'Mr Binman',
    serviceType: 'bins',
    serviceLabel: 'Bins',
    description: 'Domestic waste and recycling services',
    logoUrl: `${PLACEHOLDER}/providers/mr-binman.png`,
    iconUrl: `${PLACEHOLDER}/icons/bins.png`,
    displayOrder: 28,
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
