import { JobStatus } from '@prisma/client';
import { randomBytes } from 'crypto';

export const generateInvoiceNumber = () => {
  const year = new Date().getFullYear();
  const suffix = randomBytes(2).toString('hex').toUpperCase();
  return `INV-${year}-${suffix}`;
};

/**
 * JobStatus.PAYMENT_PENDING has two meanings:
 * - before work: Direct Trader / trader-offer job published with an unpaid upfront invoice (not live yet);
 * - after work: trader finished (booking.finishedAt set); final payment is due via a payment request.
 */
export const isAwaitingUpfrontPayment = (job: {
  status: JobStatus;
  booking?: { finishedAt?: Date | null } | null;
}): boolean => job.status === JobStatus.PAYMENT_PENDING && !job.booking?.finishedAt;

export const JOB_PLATFORM_FEE = 10;
export const PLATFORM_FEE_VAT_RATE = 0.23; // 23% Irish Standard VAT
export const TRADER_STANDARD_VAT_RATE = 0.135; // 13.5% Irish Reduced VAT for construction & repair
export const TRADER_HIGH_VAT_RATE = 0.23; // 23% Irish VAT when materials exceed two-thirds test
export const JOB_VAT_RATE = TRADER_STANDARD_VAT_RATE;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Job amount the trader bills (Payment Request / installments) and the customer pays:
 * quote + materials + site visit fee + platform fee, plus VAT. Site-visit-only = fee + VAT.
 *
 * Conforms to Irish Revenue VAT rules (Two-Thirds test & separate Brisk Platform supply).
 */
export const buildJobPaymentBreakdown = (input: {
  quotePrice: number;
  materialsTotal: number;
  siteVisitFee: number;
  siteVisitOnly?: boolean;
  isTraderVatRegistered?: boolean;
  traderOfferDiscount?: number;
}) => {
  const serviceCharge = input.siteVisitOnly ? 0 : round2(input.quotePrice);
  const materialsTotal = input.siteVisitOnly ? 0 : round2(input.materialsTotal);
  const siteVisitFee = round2(input.siteVisitFee);
  const discount = Math.min(input.traderOfferDiscount ?? 0, serviceCharge);
  const discountedBase = Math.max(0, serviceCharge - discount);

  // Trader Net
  const traderNet = round2(discountedBase + materialsTotal + siteVisitFee);

  // Two-Thirds Test (Irish Revenue): If materials (excl. VAT) exceed two-thirds of total trader price
  const twoThirdsRuleTriggered = traderNet > 0 && materialsTotal / traderNet > 2 / 3;

  const isVatReg = input.isTraderVatRegistered !== false;
  const traderVatRate = !isVatReg
    ? 0
    : twoThirdsRuleTriggered
      ? TRADER_HIGH_VAT_RATE
      : TRADER_STANDARD_VAT_RATE;
  const traderVatAmount = round2(traderNet * traderVatRate);

  // Platform Fee (Brisk's own supply: €10.00 + 23% VAT = €12.30 gross)
  const platformFee = input.siteVisitOnly ? 0 : JOB_PLATFORM_FEE;
  const platformFeeVat = input.siteVisitOnly ? 0 : round2(platformFee * PLATFORM_FEE_VAT_RATE);
  const platformFeeGross = round2(platformFee + platformFeeVat);

  const totalVat = round2(traderVatAmount + platformFeeVat);
  const totalAmount = round2(traderNet + traderVatAmount + platformFeeGross);

  return {
    serviceCharge,
    materialsTotal,
    siteVisitFee,
    platformFee,
    platformFeeVat,
    twoThirdsRuleTriggered,
    traderVatRate,
    traderVatAmount,
    vatRate: traderVatRate,
    vatAmount: totalVat,
    totalAmount,
  };
};
