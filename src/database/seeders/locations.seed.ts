import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

type SeedCounty = { code: string; name: string };
type SeedCountry = { code: string; name: string; counties: SeedCounty[] };

/** Island-of-Ireland counties — same codes the website/trader forms use today. */
const LOCATIONS: SeedCountry[] = [
  {
    code: 'IE',
    name: 'Ireland',
    counties: [
      { code: 'CW', name: 'Carlow' },
      { code: 'CN', name: 'Cavan' },
      { code: 'CE', name: 'Clare' },
      { code: 'CO', name: 'Cork' },
      { code: 'DL', name: 'Donegal' },
      { code: 'DB', name: 'Dublin' },
      { code: 'GY', name: 'Galway' },
      { code: 'KY', name: 'Kerry' },
      { code: 'KE', name: 'Kildare' },
      { code: 'KK', name: 'Kilkenny' },
      { code: 'LS', name: 'Laois' },
      { code: 'LM', name: 'Leitrim' },
      { code: 'LK', name: 'Limerick' },
      { code: 'LF', name: 'Longford' },
      { code: 'LH', name: 'Louth' },
      { code: 'MO', name: 'Mayo' },
      { code: 'MH', name: 'Meath' },
      { code: 'MN', name: 'Monaghan' },
      { code: 'OY', name: 'Offaly' },
      { code: 'RN', name: 'Roscommon' },
      { code: 'SO', name: 'Sligo' },
      { code: 'TA', name: 'Tipperary' },
      { code: 'WD', name: 'Waterford' },
      { code: 'WH', name: 'Westmeath' },
      { code: 'WX', name: 'Wexford' },
      { code: 'WW', name: 'Wicklow' },
    ],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    counties: [
      { code: 'AN', name: 'Antrim' },
      { code: 'AR', name: 'Armagh' },
      { code: 'LD', name: 'Derry' },
      { code: 'DN', name: 'Down' },
      { code: 'FM', name: 'Fermanagh' },
      { code: 'TY', name: 'Tyrone' },
    ],
  },
];

/** Idempotent: creates missing rows only; never overrides admin enable/disable or sort changes. */
export const seedLocations = async (prisma: PrismaClient) => {
  let createdCounties = 0;
  for (const [countryIndex, country] of LOCATIONS.entries()) {
    const row = await prisma.country.upsert({
      where: { code: country.code },
      update: {},
      create: { code: country.code, name: country.name, sortOrder: countryIndex },
      select: { id: true },
    });
    const result = await prisma.county.createMany({
      data: country.counties.map((county, index) => ({
        countryId: row.id,
        code: county.code,
        name: county.name,
        sortOrder: index,
      })),
      skipDuplicates: true,
    });
    createdCounties += result.count;
  }
  logger.info(`[SEED] Locations ready (${LOCATIONS.length} countries, ${createdCounties} new counties).`);
};

if (require.main === module) {
  const prisma = new PrismaClient();
  seedLocations(prisma)
    .catch((e) => {
      logger.error('[SEED] Locations failed', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
