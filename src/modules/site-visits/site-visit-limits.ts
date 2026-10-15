import { JobStatus, Prisma, TraderSiteVisitStatus } from '@prisma/client';
import { prisma } from '../../config/database';

/** Max traders that may apply (non-cancelled) to one site-visit marketplace job. */
export const MAX_SITE_VISIT_APPLICANTS = 3;

/** Active applicant = any non-cancelled site-visit request on the job. */
export const countActiveSiteVisitApplicants = async (
  jobId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
) =>
  tx.traderSiteVisitRequest.count({
    where: { jobId, status: { not: TraderSiteVisitStatus.CANCELLED } },
  });

/**
 * PUBLISHED marketplace job IDs that already have {@link MAX_SITE_VISIT_APPLICANTS}
 * applicants — hide from Discover for traders who have not applied yet.
 */
export const listSiteVisitFullJobIds = async (): Promise<string[]> => {
  const grouped = await prisma.traderSiteVisitRequest.groupBy({
    by: ['jobId'],
    where: {
      status: { not: TraderSiteVisitStatus.CANCELLED },
      job: { status: JobStatus.PUBLISHED, traderId: null },
    },
    _count: { _all: true },
  });
  return grouped.filter((g) => g._count._all >= MAX_SITE_VISIT_APPLICANTS).map((g) => g.jobId);
};
