import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { ConflictError, NotFoundError } from '../../utils/errors';
import type {
  CreateCountryInput,
  CreateCountyInput,
  UpdateCountryInput,
  UpdateCountyInput,
} from './locations.validation';

const countySelect = {
  id: true,
  code: true,
  name: true,
  isActive: true,
  sortOrder: true,
} satisfies Prisma.CountySelect;

const countyOrder: Prisma.CountyOrderByWithRelationInput[] = [{ sortOrder: 'asc' }, { name: 'asc' }];
const countryOrder: Prisma.CountryOrderByWithRelationInput[] = [{ sortOrder: 'asc' }, { name: 'asc' }];

/** Flag emoji from ISO 3166-1 alpha-2 code (IE → 🇮🇪). */
const flagEmoji = (code: string): string =>
  /^[A-Za-z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
    : '';

const withFlag = <T extends { code: string }>(country: T) => ({ ...country, flag: flagEmoji(country.code) });

const rethrowUnique = (error: unknown, message: string): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictError(message, { code: 'LOCATION_EXISTS' });
  }
  throw error;
};

/** Public dropdown data: only enabled countries with their enabled counties. */
export const listActiveCountries = async (countryCode?: string) => {
  const countries = await prisma.country.findMany({
    where: {
      isActive: true,
      ...(countryCode ? { code: countryCode.toUpperCase() } : {}),
    },
    orderBy: countryOrder,
    select: {
      id: true,
      code: true,
      name: true,
      counties: {
        where: { isActive: true },
        orderBy: countyOrder,
        select: { id: true, code: true, name: true },
      },
    },
  });
  const items = countries.map(withFlag);
  return { items, total: items.length };
};

export const listCountriesForAdmin = async (isActive?: boolean) => {
  const countries = await prisma.country.findMany({
    where: isActive === undefined ? {} : { isActive },
    orderBy: countryOrder,
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      sortOrder: true,
      updatedAt: true,
      counties: { orderBy: countyOrder, select: countySelect },
    },
  });
  const items = countries.map((country) => ({
    ...withFlag(country),
    countiesTotal: country.counties.length,
    countiesActive: country.counties.filter((c) => c.isActive).length,
  }));
  return { items, total: items.length };
};

export const createCountry = async (input: CreateCountryInput) =>
  prisma.country
    .create({
      data: input,
      select: { id: true, code: true, name: true, isActive: true, sortOrder: true },
    })
    .catch((e) => rethrowUnique(e, 'A country with this code or name already exists.'));

export const updateCountry = async (countryId: string, input: UpdateCountryInput) => {
  const exists = await prisma.country.findUnique({ where: { id: countryId }, select: { id: true } });
  if (!exists) throw new NotFoundError('Country not found.');
  return prisma.country
    .update({
      where: { id: countryId },
      data: input,
      select: { id: true, code: true, name: true, isActive: true, sortOrder: true },
    })
    .catch((e) => rethrowUnique(e, 'A country with this name already exists.'));
};

export const createCounty = async (countryId: string, input: CreateCountyInput) => {
  const exists = await prisma.country.findUnique({ where: { id: countryId }, select: { id: true } });
  if (!exists) throw new NotFoundError('Country not found.');
  return prisma.county
    .create({
      data: { countryId, ...input, code: input.code?.toUpperCase() || null },
      select: { ...countySelect, countryId: true },
    })
    .catch((e) => rethrowUnique(e, 'This county already exists for the country.'));
};

export const updateCounty = async (countyId: string, input: UpdateCountyInput) => {
  const exists = await prisma.county.findUnique({ where: { id: countyId }, select: { id: true } });
  if (!exists) throw new NotFoundError('County not found.');
  return prisma.county
    .update({
      where: { id: countyId },
      data: {
        ...input,
        ...(input.code !== undefined ? { code: input.code?.toUpperCase() || null } : {}),
      },
      select: { ...countySelect, countryId: true },
    })
    .catch((e) => rethrowUnique(e, 'This county already exists for the country.'));
};

/** Public: enabled counties of one enabled country (by id or ISO code). */
export const listActiveCounties = async (query: { countryId?: string; countryCode?: string }) => {
  const country = await prisma.country.findFirst({
    where: {
      isActive: true,
      ...(query.countryId ? { id: query.countryId } : { code: query.countryCode!.toUpperCase() }),
    },
    select: {
      id: true,
      code: true,
      name: true,
      counties: {
        where: { isActive: true },
        orderBy: countyOrder,
        select: { id: true, code: true, name: true },
      },
    },
  });
  if (!country) throw new NotFoundError('Country not found or not available.');
  const { counties, ...countryInfo } = country;
  return { country: withFlag(countryInfo), items: counties, total: counties.length };
};
