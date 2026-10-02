import type Stripe from 'stripe';
import { prisma } from '../config/database';
import { BadRequestError } from '../utils/errors';

/** Trader.country is stored as a name ("Ireland") or ISO code — Stripe needs ISO alpha-2. */
export const resolveCountryIso = async (country: string | null | undefined): Promise<string> => {
  const value = country?.trim();
  const match = value
    ? await prisma.country.findFirst({
        where: {
          OR: [{ code: value.toUpperCase() }, { name: { equals: value, mode: 'insensitive' } }],
        },
        select: { code: true },
      })
    : null;
  if (!match) {
    throw new BadRequestError('Set your country in your profile before connecting payouts.', {
      code: 'COUNTRY_REQUIRED',
    });
  }
  return match.code;
};

export const serializeConnectAccount = (account: Stripe.Account) => ({
  connected: true,
  accountId: account.id,
  detailsSubmitted: account.details_submitted ?? false,
  payoutsEnabled: account.payouts_enabled ?? false,
  transfersEnabled: account.capabilities?.transfers === 'active',
  defaultCurrency: account.default_currency?.toUpperCase() ?? null,
  requirementsDue: account.requirements?.currently_due ?? [],
  disabledReason: account.requirements?.disabled_reason ?? null,
});
