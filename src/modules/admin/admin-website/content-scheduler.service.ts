import { prisma } from '../../../config/database';
import { CmsPublishStatus } from '@prisma/client';
import { logger } from '../../../utils/logger';

/**
 * Automatically publishes any blog post or knowledge guide whose scheduledPublishAt time has arrived.
 */
export const publishDueScheduledContent = async () => {
  const now = new Date();

  try {
    const [postsResult, guidesResult] = await Promise.all([
      prisma.cmsBlogPost.updateMany({
        where: {
          status: CmsPublishStatus.SCHEDULED,
          scheduledPublishAt: { lte: now },
          deletedAt: null,
        },
        data: {
          status: CmsPublishStatus.PUBLISHED,
          publishedAt: now,
        },
      }),
      prisma.cmsKnowledgeGuide.updateMany({
        where: {
          status: CmsPublishStatus.SCHEDULED,
          scheduledPublishAt: { lte: now },
          deletedAt: null,
        },
        data: {
          status: CmsPublishStatus.PUBLISHED,
          publishedAt: now,
        },
      }),
    ]);

    if (postsResult.count > 0 || guidesResult.count > 0) {
      logger.info(
        `[ContentScheduler] Auto-published: ${postsResult.count} blog post(s), ${guidesResult.count} knowledge guide(s).`
      );
    }

    return {
      publishedPosts: postsResult.count,
      publishedGuides: guidesResult.count,
      checkedAt: now,
    };
  } catch (error) {
    logger.error('[ContentScheduler] Error auto-publishing scheduled content:', error);
    return {
      publishedPosts: 0,
      publishedGuides: 0,
      checkedAt: now,
      error,
    };
  }
};

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Starts background timer to periodically auto-publish due content (runs every minute by default).
 */
export const startContentScheduler = (intervalMs: number = 60000) => {
  if (schedulerInterval) return;

  // Run once immediately on startup
  publishDueScheduledContent().catch(() => {});

  schedulerInterval = setInterval(() => {
    publishDueScheduledContent().catch(() => {});
  }, intervalMs);

  if (schedulerInterval.unref) {
    schedulerInterval.unref();
  }
};
