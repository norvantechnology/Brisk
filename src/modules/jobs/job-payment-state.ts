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
export const JOB_VAT_RATE = 0.2;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Job amount the trader bills (Payment Request / installments) and the customer pays:
 * quote + materials + site visit fee + platform fee, plus VAT. Site-visit-only = fee + VAT.
 */
export const buildJobPaymentBreakdown = (input: {
  quotePrice: number;
  materialsTotal: number;
  siteVisitFee: number;
  siteVisitOnly?: boolean;
}) => {
  const serviceCharge = input.siteVisitOnly ? 0 : input.quotePrice;
  const materialsTotal = input.siteVisitOnly ? 0 : round2(input.materialsTotal);
  const siteVisitFee = input.siteVisitFee;
  const platformFee = input.siteVisitOnly ? 0 : JOB_PLATFORM_FEE;
  const subtotal = round2(serviceCharge + materialsTotal + siteVisitFee + platformFee);
  const vatAmount = round2(subtotal * JOB_VAT_RATE);
  return {
    serviceCharge,
    materialsTotal,
    siteVisitFee,
    platformFee,
    vatRate: JOB_VAT_RATE,
    vatAmount,
    totalAmount: round2(subtotal + vatAmount),
  };
};
