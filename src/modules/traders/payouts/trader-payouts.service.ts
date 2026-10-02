import { TraderType } from '@prisma/client';
import { prisma } from '../../../config/database';
import { env } from '../../../config/env';
import { getStripe, toPaymentError } from '../../../services/stripe.service';
import { resolveCountryIso, serializeConnectAccount } from '../../../services/stripe-connect.service';
import { BadRequestError, NotFoundError } from '../../../utils/errors';
import type { StripeOnboardingLinkInput } from './trader-payouts.validation';

const getTrader = async (userId: string) => {
  const trader = await prisma.trader.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      traderType: true,
      country: true,
      stripeAccountId: true,
      user: { select: { email: true, country: true } },
    },
  });
  if (!trader) throw new NotFoundError('Trader profile not found.');
  return trader;
};

/** Stripe Connect Express onboarding — trader adds bank / identity details on Stripe's hosted page. */
export const createStripeOnboardingLink = async (userId: string, input: StripeOnboardingLinkInput) => {
  const returnUrl = input.returnUrl ?? env.STRIPE_CONNECT_RETURN_URL;
  const refreshUrl = input.refreshUrl ?? env.STRIPE_CONNECT_REFRESH_URL;
  if (!returnUrl || !refreshUrl) {
    throw new BadRequestError('returnUrl and refreshUrl are required.', {
      code: 'CONNECT_URLS_REQUIRED',
    });
  }

  const trader = await getTrader(userId);
  try {
    const stripe = getStripe();
    let accountId = trader.stripeAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create(
        {
          type: 'express',
          country: await resolveCountryIso(trader.country ?? trader.user.country),
          email: trader.user.email,
          business_type: trader.traderType === TraderType.COMPANY ? 'company' : 'individual',
          capabilities: { transfers: { requested: true } },
          metadata: { traderId: trader.id, userId: trader.userId },
        },
        { idempotencyKey: `connect-account-${trader.id}` }
      );
      accountId = account.id;
      await prisma.trader.update({ where: { id: trader.id }, data: { stripeAccountId: accountId } });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });
    return {
      accountId,
      url: link.url,
      expiresAt: new Date(link.expires_at * 1000).toISOString(),
    };
  } catch (error) {
    throw toPaymentError(error);
  }
};

export const getStripeConnectStatus = async (userId: string) => {
  const trader = await getTrader(userId);
  if (!trader.stripeAccountId) {
    return {
      connected: false,
      accountId: null,
      detailsSubmitted: false,
      payoutsEnabled: false,
      transfersEnabled: false,
      defaultCurrency: null,
      requirementsDue: [] as string[],
      disabledReason: null,
    };
  }
  try {
    return serializeConnectAccount(await getStripe().accounts.retrieve(trader.stripeAccountId));
  } catch (error) {
    throw toPaymentError(error);
  }
};
