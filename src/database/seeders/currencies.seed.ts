import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

/** Initial catalog only — activation is controlled in DB via admin (isActive). */
const DEFAULT_CURRENCIES = [
  { code: 'EUR', name: 'Euro', symbol: '€', sortOrder: 1 },
  { code: 'GBP', name: 'British Pound', symbol: '£', sortOrder: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', sortOrder: 3 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', sortOrder: 4 },
];

/** Initial rates: 1 EUR = X. Admin updates via panel; seed does not overwrite existing rates. */
const DEFAULT_RATES_FROM_EUR: Record<string, number> = {
  EUR: 1,
  GBP: 0.86,
  USD: 1.08,
  INR: 90.5,
};

export async function seedCurrencies(prisma: PrismaClient): Promise<void> {
  for (const c of DEFAULT_CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: c.code },
      create: {
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        sortOrder: c.sortOrder,
        isActive: true,
      },
      // Do not touch isActive — runtime enable/disable is DB/admin only.
      update: {
        name: c.name,
        symbol: c.symbol,
        sortOrder: c.sortOrder,
      },
    });
  }

  await prisma.platformCurrencySettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', baseCurrency: 'EUR' },
    update: {},
  });

  for (const [toCurrency, rate] of Object.entries(DEFAULT_RATES_FROM_EUR)) {
    if (toCurrency === 'EUR') continue;
    await prisma.exchangeRate.upsert({
      where: {
        fromCurrency_toCurrency: { fromCurrency: 'EUR', toCurrency },
      },
      create: {
        fromCurrency: 'EUR',
        toCurrency,
        rate,
      },
      update: {},
    });
  }

  logger.info('✅ Currencies and exchange rates seeded (EUR base).');
}
