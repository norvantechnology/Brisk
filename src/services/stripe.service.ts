import Stripe from 'stripe';
import { PaymentMethod } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { BadRequestError, ConflictError, ServiceUnavailableError } from '../utils/errors';

/** PaymentIntent.metadata.kind — routes webhook events to the right finalizer. */
export const STRIPE_KIND_INVOICE = 'INVOICE';
export const STRIPE_KIND_PAYMENT_REQUEST = 'PAYMENT_REQUEST';

let client: Stripe | null = null;

export const isStripeConfigured = (): boolean =>
  Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PUBLISHABLE_KEY);

export const getStripe = (): Stripe => {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PUBLISHABLE_KEY) {
    throw new ServiceUnavailableError('Online payments are not configured yet.', {
      code: 'PAYMENTS_NOT_CONFIGURED',
    });
  }
  if (!client) {
    client = new Stripe(env.STRIPE_SECRET_KEY, {
      appInfo: { name: 'brisk-backend' },
      maxNetworkRetries: 2,
      timeout: 20_000,
    });
  }
  return client;
};

/** Currencies Stripe charges without minor units. */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

export const toMinorUnits = (amount: number, currencyCode: string): number =>
  ZERO_DECIMAL_CURRENCIES.has(currencyCode.toUpperCase())
    ? Math.round(amount)
    : Math.round(amount * 100);

export const fromMinorUnits = (amount: number, currencyCode: string): number =>
  ZERO_DECIMAL_CURRENCIES.has(currencyCode.toUpperCase()) ? amount : amount / 100;

/** Stripe Customer for a Brisk user (created once, reused for saved cards). */
export const ensureStripeCustomer = async (userId: string): Promise<string> => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, mobileNumber: true, stripeCustomerId: true },
  });
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await getStripe().customers.create(
    {
      email: user.email,
      name: user.fullName,
      phone: user.mobileNumber || undefined,
      metadata: { userId: user.id },
    },
    { idempotencyKey: `customer-${user.id}` }
  );
  await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
};

/** Everything the mobile PaymentSheet / web Payment Element needs for one PaymentIntent. */
export const buildClientPaymentConfig = async (customerId: string, intent: Stripe.PaymentIntent) => {
  const ephemeralKey = await getStripe().ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: Stripe.API_VERSION }
  );
  return {
    paymentIntentId: intent.id,
    clientSecret: intent.client_secret,
    customerId,
    ephemeralKey: ephemeralKey.secret,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY!,
    stripeMerchantIdentifier: env.STRIPE_MERCHANT_IDENTIFIER ?? null,
  };
};

/** Cancel an unused PaymentIntent so it can never be charged later (best effort). */
export const cancelPaymentIntentQuietly = async (paymentIntentId: string | null | undefined) => {
  if (!paymentIntentId || !paymentIntentId.startsWith('pi_') || !isStripeConfigured()) return;
  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (
      intent.status === 'requires_payment_method' ||
      intent.status === 'requires_confirmation' ||
      intent.status === 'requires_action'
    ) {
      await stripe.paymentIntents.cancel(paymentIntentId);
    }
  } catch {
    // Unknown / foreign intents are ignored.
  }
};

export type ChargeDetails = {
  cardBrand: string | null;
  cardLast4: string | null;
  walletType: string | null;
};

/** Card brand / last4 / wallet (apple_pay, google_pay) from the intent's latest charge. */
export const getChargeDetails = async (intent: Stripe.PaymentIntent): Promise<ChargeDetails> => {
  const chargeId =
    typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id;
  if (!chargeId) return { cardBrand: null, cardLast4: null, walletType: null };
  const charge = await getStripe().charges.retrieve(chargeId);
  const card = charge.payment_method_details?.card;
  return {
    cardBrand: card?.brand ?? null,
    cardLast4: card?.last4 ?? null,
    walletType: card?.wallet?.type ?? null,
  };
};

/** Actual method used on the sheet (wallet wins over the method the app pre-selected). */
export const paymentMethodFromCharge = (charge: ChargeDetails | null): PaymentMethod | null => {
  if (charge?.walletType === 'apple_pay') return PaymentMethod.APPLE_PAY;
  if (charge?.walletType === 'google_pay') return PaymentMethod.GOOGLE_PAY;
  if (charge?.cardLast4) return PaymentMethod.CARD;
  return null;
};

/**
 * Load the intent from Stripe (never trust the app) and require it to be paid in full
 * for exactly the amount/currency we recorded.
 */
export const retrieveSucceededIntent = async (
  paymentIntentId: string,
  expectedAmount: number,
  currencyCode: string
): Promise<Stripe.PaymentIntent> => {
  const intent = await getStripe().paymentIntents.retrieve(paymentIntentId);
  if (intent.status === 'processing') {
    throw new ConflictError('Your payment is still processing. Please check again shortly.', {
      code: 'PAYMENT_PROCESSING',
    });
  }
  if (intent.status !== 'succeeded') {
    throw new BadRequestError('Payment has not been completed yet.', {
      code: 'PAYMENT_NOT_COMPLETED',
      data: { stripeStatus: intent.status },
    });
  }
  assertIntentMatches(intent, expectedAmount, currencyCode);
  return intent;
};

export const assertIntentMatches = (
  intent: Stripe.PaymentIntent,
  expectedAmount: number,
  currencyCode: string
) => {
  if (
    intent.amount_received !== toMinorUnits(expectedAmount, currencyCode) ||
    intent.currency !== currencyCode.toLowerCase()
  ) {
    throw new BadRequestError('Paid amount does not match the amount due.', {
      code: 'PAYMENT_AMOUNT_MISMATCH',
    });
  }
};

/** Stripe API errors → clean 4xx/503 for the app; anything else is rethrown as-is. */
export const toPaymentError = (error: unknown): unknown => {
  if (error instanceof Stripe.errors.StripeError) {
    if (
      error instanceof Stripe.errors.StripeConnectionError ||
      error instanceof Stripe.errors.StripeAPIError ||
      error instanceof Stripe.errors.StripeRateLimitError
    ) {
      return new ServiceUnavailableError('Payment provider is unavailable. Please try again.', {
        code: 'PAYMENT_PROVIDER_UNAVAILABLE',
      });
    }
    if (error instanceof Stripe.errors.StripeAuthenticationError) {
      return new ServiceUnavailableError('Online payments are not configured correctly.', {
        code: 'PAYMENTS_NOT_CONFIGURED',
      });
    }
    return new BadRequestError(error.message, {
      code: 'PAYMENT_PROVIDER_ERROR',
      data: { stripeCode: error.code ?? null },
    });
  }
  return error;
};
