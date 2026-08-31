import { prisma } from '../../../config/database';
import { BadRequestError, NotFoundError } from '../../../utils/errors';
import {
  getBaseCurrencyCode,
  getPlatformCurrencySettings,
  invalidateRateCache,
  listActiveCurrencies,
} from '../../../services/currency.service';
import type {
  UpdateCurrencyInput,
  UpsertCurrencyInput,
  UpsertExchangeRatesInput,
} from './admin-currency.validation';

export const getCurrencyOverview = async () => {
  const settings = await getPlatformCurrencySettings();
  const [currencies, rates] = await Promise.all([
    prisma.currency.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
    prisma.exchangeRate.findMany({
      where: { fromCurrency: settings.baseCurrency },
      orderBy: { toCurrency: 'asc' },
    }),
  ]);

  return {
    baseCurrency: settings.baseCurrency,
    currencies,
    exchangeRates: rates.map((r) => ({
      fromCurrency: r.fromCurrency,
      toCurrency: r.toCurrency,
      rate: Number(r.rate),
      effectiveFrom: r.effectiveFrom,
      updatedAt: r.updatedAt,
    })),
  };
};

export const updatePlatformBaseCurrency = async (
  baseCurrency: string,
  adminId: string
) => {
  const exists = await prisma.currency.findFirst({
    where: { code: baseCurrency, isActive: true },
  });
  if (!exists) {
    throw new BadRequestError(`Currency "${baseCurrency}" is not active.`);
  }

  const settings = await prisma.platformCurrencySettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', baseCurrency, updatedById: adminId },
    update: { baseCurrency, updatedById: adminId },
  });

  invalidateRateCache();
  return settings;
};

export const upsertCurrency = async (input: UpsertCurrencyInput) => {
  return prisma.currency.upsert({
    where: { code: input.code },
    create: {
      code: input.code,
      name: input.name,
      symbol: input.symbol,
      decimalPlaces: input.decimalPlaces,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
    update: {
      name: input.name,
      symbol: input.symbol,
      decimalPlaces: input.decimalPlaces,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
  });
};

export const updateCurrency = async (code: string, input: UpdateCurrencyInput) => {
  const existing = await prisma.currency.findUnique({ where: { code } });
  if (!existing) throw new NotFoundError('Currency not found.');

  const base = await getBaseCurrencyCode();
  if (code === base && input.isActive === false) {
    throw new BadRequestError('Cannot deactivate the platform base currency.');
  }

  return prisma.currency.update({
    where: { code },
    data: input,
  });
};

export const upsertExchangeRates = async (
  input: UpsertExchangeRatesInput,
  adminId: string
) => {
  const base = await getBaseCurrencyCode();

  for (const row of input.rates) {
    if (row.toCurrency === base) {
      throw new BadRequestError(`Cannot set exchange rate for base currency ${base}.`);
    }
    await prisma.currency.findUniqueOrThrow({ where: { code: row.toCurrency } });
  }

  const updated = await prisma.$transaction(
    input.rates.map((row) =>
      prisma.exchangeRate.upsert({
        where: {
          fromCurrency_toCurrency: { fromCurrency: base, toCurrency: row.toCurrency },
        },
        create: {
          fromCurrency: base,
          toCurrency: row.toCurrency,
          rate: row.rate,
          updatedById: adminId,
        },
        update: {
          rate: row.rate,
          effectiveFrom: new Date(),
          updatedById: adminId,
        },
      })
    )
  );

  invalidateRateCache();

  return updated.map((r) => ({
    fromCurrency: r.fromCurrency,
    toCurrency: r.toCurrency,
    rate: Number(r.rate),
    effectiveFrom: r.effectiveFrom,
  }));
};

export const getPublicCurrencySnapshot = async () => {
  const settings = await getPlatformCurrencySettings();
  const currencies = await listActiveCurrencies();
  const rates = await prisma.exchangeRate.findMany({
    where: { fromCurrency: settings.baseCurrency },
    select: { toCurrency: true, rate: true, updatedAt: true },
    orderBy: { toCurrency: 'asc' },
  });

  return {
    baseCurrency: settings.baseCurrency,
    currencies: currencies.map((c) => ({
      code: c.code,
      name: c.name,
      symbol: c.symbol,
      decimalPlaces: c.decimalPlaces,
    })),
    exchangeRates: rates.map((r) => ({
      toCurrency: r.toCurrency,
      rate: Number(r.rate),
      updatedAt: r.updatedAt,
    })),
  };
};
