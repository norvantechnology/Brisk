import { JobStatus } from '@prisma/client';

/**
 * JobStatus.PAYMENT_PENDING has two meanings:
 * - before work: Direct Trader / trader-offer job published with an unpaid upfront invoice (not live yet);
 * - after work: trader finished (booking.finishedAt set) and sent the final payment request.
 */
export const isAwaitingUpfrontPayment = (job: {
  status: JobStatus;
  booking?: { finishedAt?: Date | null } | null;
}): boolean => job.status === JobStatus.PAYMENT_PENDING && !job.booking?.finishedAt;
