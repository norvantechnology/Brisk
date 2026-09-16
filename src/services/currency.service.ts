import { prisma } from '../config/database';
import { BadRequestError, NotFoundError } from '../utils/errors';

export type MoneyPayload = {
  amount: number;
  currency: string;
  formatted: string;
  /** Present only for live/catalog display when viewer currency differs from stored. */
  displayAmount?: number;
  displayCurrency?: string;
  displayFormatted?: string;
  exchangeRate?: number;
  /** True for invoices/payments/refunds — never convert on read. */
  isHistorical?: boolean;
};

type CurrencyMeta = {
  code: string;
  symbol: string;
  decimalPlaces: number;
};

const rateCache = new Map<string, { expiresAt: number; rates: Map<string, number> }>();
const CACHE_TTL_MS = 60_000;

const cacheKey = (base: string) => `rates:${base}`;

const roundMoney = (value: number, decimalPlaces: number) => {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
};

export const getPlatformCurrencySettings = async () => {
  let settings = await prisma.platformCurrencySettings.findUnique({
    where: { id: 'default' },
  });
  if (!settings) {
    settings = await prisma.platformCurrencySettings.create({
      data: { id: 'default', baseCurrency: 'EUR' },
    });
  }
  return settings;
};

export const getBaseCurrencyCode = async () => {
  const settings = await getPlatformCurrencySettings();
  return settings.baseCurrency;
};

export const getCurrencyMeta = async (code: string): Promise<CurrencyMeta> => {
  const currency = await prisma.currency.findUnique({ where: { code } });
  if (currency) {
    return {
      code: currency.code,
      symbol: currency.symbol,
      decimalPlaces: currency.decimalPlaces,
    };
  }
  return { code, symbol: code, decimalPlaces: 2 };
};

export const formatMoney = async (amount: number, currencyCode: string) => {
  const meta = await getCurrencyMeta(currencyCode);
  const rounded = roundMoney(amount, meta.decimalPlaces);
  return `${meta.symbol}${rounded.toFixed(meta.decimalPlaces)}`;
};

const loadRatesFromBase = async (baseCurrency: string) => {
  const cached = rateCache.get(cacheKey(baseCurrency));
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rates;
  }

  const rows = await prisma.exchangeRate.findMany({
    where: { fromCurrency: baseCurrency },
  });

  const rates = new Map<string, number>();
  rates.set(baseCurrency, 1);
  for (const row of rows) {
    rates.set(row.toCurrency, Number(row.rate));
  }

  rateCache.set(cacheKey(baseCurrency), {
    rates,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return rates;
};

export const invalidateRateCache = () => {
  rateCache.clear();
};

/** Convert amount between currencies using admin rates (via platform base). */
export const convertAmount = async (
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<{ amount: number; rate: number }> => {
  if (fromCurrency === toCurrency) {
    return { amount, rate: 1 };
  }

  const base = await getBaseCurrencyCode();
  const rates = await loadRatesFromBase(base);

  const rateFromBase = (code: string) => {
    if (code === base) return 1;
    const r = rates.get(code);
    if (!r) {
      throw new BadRequestError(`Exchange rate not configured for ${base} → ${code}.`);
    }
    return r;
  };

  const inBase = fromCurrency === base ? amount : amount / rateFromBase(fromCurrency);
  const rate =
    fromCurrency === base
      ? rateFromBase(toCurrency)
      : toCurrency === base
        ? 1 / rateFromBase(fromCurrency)
        : rateFromBase(toCurrency) / rateFromBase(fromCurrency);

  const toMeta = await getCurrencyMeta(toCurrency);
  const converted = roundMoney(inBase * rateFromBase(toCurrency), toMeta.decimalPlaces);

  return { amount: converted, rate: roundMoney(rate, 6) };
};

/** Historical records: return stored amount + currency only — never convert. */
export const serializeHistoricalMoney = async (
  amount: number | { toString(): string },
  currencyCode: string
): Promise<MoneyPayload> => {
  const numeric = Number(amount);
  const formatted = await formatMoney(numeric, currencyCode);
  return {
    amount: numeric,
    currency: currencyCode,
    formatted,
    isHistorical: true,
  };
};

/** Catalog / live prices: include optional display conversion for viewer's preferred currency. */
export const serializeDisplayMoney = async (
  amount: number | { toString(): string },
  storedCurrency: string,
  viewerCurrency?: string | null
): Promise<MoneyPayload> => {
  const numeric = Number(amount);
  const formatted = await formatMoney(numeric, storedCurrency);
  const payload: MoneyPayload = {
    amount: numeric,
    currency: storedCurrency,
    formatted,
    isHistorical: false,
  };

  if (!viewerCurrency || viewerCurrency === storedCurrency) {
    return payload;
  }

  try {
    const { amount: displayAmount, rate } = await convertAmount(
      numeric,
      storedCurrency,
      viewerCurrency
    );
    payload.displayAmount = displayAmount;
    payload.displayCurrency = viewerCurrency;
    payload.displayFormatted = await formatMoney(displayAmount, viewerCurrency);
    payload.exchangeRate = rate;
  } catch {
    // Missing rate — return stored currency only
  }

  return payload;
};

export const resolveUserCurrency = async (userId?: string | null) => {
  if (!userId) return getBaseCurrencyCode();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferredCurrency: true },
  });
  return user?.preferredCurrency ?? (await getBaseCurrencyCode());
};

/** Brisk marketplace supports EUR (Ireland) and GBP (UK) only. */
export const BRISK_DISPLAY_CURRENCIES = ['EUR', 'GBP'] as const;
export type BriskDisplayCurrency = (typeof BRISK_DISPLAY_CURRENCIES)[number];

const asBriskCurrency = (code?: string | null): BriskDisplayCurrency | null => {
  const c = code?.trim().toUpperCase();
  if (c === 'EUR' || c === 'GBP') return c;
  return null;
};

/** Map country name/code → EUR | GBP (null if unknown). */
export const currencyCodeFromCountry = (country?: string | null): BriskDisplayCurrency | null => {
  if (!country?.trim()) return null;
  const c = country.trim().toLowerCase();
  if (
    c === 'gb' ||
    c === 'uk' ||
    c === 'united kingdom' ||
    c === 'great britain' ||
    c === 'england' ||
    c === 'scotland' ||
    c === 'wales' ||
    c === 'northern ireland'
  ) {
    return 'GBP';
  }
  if (c === 'ie' || c === 'ireland' || c === 'republic of ireland' || c === 'eire' || c === 'éire') {
    return 'EUR';
  }
  return null;
};

/**
 * Discover / price display currency — dynamic, not lat/lng based.
 * Priority: customer preferred → trader preferred → job/address country → trader country → platform base (EUR/GBP only).
 */
export const resolveDiscoverCurrency = async (input: {
  customerPreferredCurrency?: string | null;
  traderPreferredCurrency?: string | null;
  jobCountry?: string | null;
  traderCountry?: string | null;
}): Promise<{ currencyCode: string; currencySymbol: string }> => {
  let code =
    asBriskCurrency(input.customerPreferredCurrency) ||
    asBriskCurrency(input.traderPreferredCurrency) ||
    currencyCodeFromCountry(input.jobCountry) ||
    currencyCodeFromCountry(input.traderCountry) ||
    asBriskCurrency(await getBaseCurrencyCode()) ||
    'EUR';

  const meta = await getCurrencyMeta(code);
  return { currencyCode: meta.code, currencySymbol: meta.symbol };
};

/**
 * @deprecated Prefer resolveDiscoverCurrency — lat/lng must not invent INR/USD for Brisk.
 * Kept for any legacy callers; only returns EUR/GBP.
 */
export const inferCurrencyCodeFromCoords = (lat: number, lng: number): string => {
  // Ireland
  if (lat >= 51.2 && lat <= 55.6 && lng >= -11 && lng <= -5.2) return 'EUR';
  // United Kingdom (approx)
  if (lat >= 49.8 && lat <= 61 && lng >= -8.5 && lng <= 2) return 'GBP';
  return 'EUR';
};

export const resolveCurrencyForCoords = async (
  lat?: number | null,
  lng?: number | null
): Promise<{ currencyCode: string; currencySymbol: string }> => {
  const code =
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
      ? inferCurrencyCodeFromCoords(lat, lng)
      : 'EUR';
  const meta = await getCurrencyMeta(asBriskCurrency(code) || 'EUR');
  return { currencyCode: meta.code, currencySymbol: meta.symbol };
};

export const listActiveCurrencies = async () => {
  return prisma.currency.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  });
};

export const assertActiveCurrency = async (code: string) => {
  const currency = await prisma.currency.findFirst({
    where: { code, isActive: true },
  });
  if (!currency) {
    throw new BadRequestError(`Currency "${code}" is not supported.`);
  }
  return currency;
};

export const getUserPreferredCurrency = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferredCurrency: true },
  });
  if (!user) throw new NotFoundError('User not found.');
  return user.preferredCurrency;
};

/** Currency code to stamp on new financial records (uses user's preference at write time). */
export const currencyForNewRecord = async (userId?: string | null) => {
  return resolveUserCurrency(userId);
};

export const discountLabelForCurrency = (
  type: string,
  value: number,
  currencySymbol: string,
  customLabel?: string | null
) => {
  if (customLabel) return customLabel;
  if (type === 'PERCENTAGE') return `${value}%`;
  if (type === 'FREE_SERVICE') return 'Free Visit';
  return `Fixed ${currencySymbol}${value}`;
};
