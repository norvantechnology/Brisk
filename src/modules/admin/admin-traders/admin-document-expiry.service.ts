import { Prisma, TraderDocumentStatus } from '@prisma/client';
import { prisma } from '../../../config/database';
import { buildPaginationMeta, parsePageLimit } from '../../../utils/pagination';
import { buildListOrderBy, pageIdsByComputedKey, resolveSortDir, type SortDir } from '../../../utils/list-sort';
import { formatDocumentExpiryDate } from '../../document-rules/document-expiry';
import {
  DAY_MS,
  EXPIRY_REMINDER_WINDOW_DAYS,
  todayInReminderZone,
} from '../../../services/document-expiry-reminder.service';
import {
  expiryStatusFor,
  type DocumentExpiryStatus,
} from '../../traders/trader-document-expiry.service';

export type AdminExpiringDocumentsQuery = {
  withinDays?: number;
  expiryStatus?: DocumentExpiryStatus;
  search?: string;
  traderId?: string;
  page?: number | string;
  limit?: number | string;
  sortBy?: string;
  sortOrder?: string;
};

type ExpiringSortMap = Record<string, (dir: SortDir) => Prisma.TraderDocumentOrderByWithRelationInput | Prisma.TraderDocumentOrderByWithRelationInput[]>;

const EXPIRING_DOCUMENT_SORT_MAP: ExpiringSortMap = {
  expiryDate: (dir) => ({ expiryDate: { sort: dir, nulls: 'last' } }),
  daysLeft: (dir) => ({ expiryDate: { sort: dir, nulls: 'last' } }),
  documentName: (dir) => [{ documentRule: { name: dir } }, { expiryDate: 'asc' }],
  documentKey: (dir) => [{ documentRule: { documentKey: dir } }, { expiryDate: 'asc' }],
  scope: (dir) => [{ documentRule: { scope: dir } }, { expiryDate: 'asc' }],
  required: (dir) => [{ documentRule: { required: dir } }, { expiryDate: 'asc' }],
  fileName: (dir) => [{ fileName: { sort: dir, nulls: 'last' } }, { expiryDate: 'asc' }],
  status: (dir) => [{ status: dir }, { expiryDate: 'asc' }],
  lastReminderStage: (dir) => [{ expiryReminderStage: { sort: dir, nulls: 'last' } }, { expiryDate: 'asc' }],
  uploadedAt: (dir) => [{ uploadedAt: dir }, { expiryDate: 'asc' }],
  email: (dir) => [{ trader: { user: { email: dir } } }, { expiryDate: 'asc' }],
  mobileNumber: (dir) => [{ trader: { user: { mobileNumber: dir } } }, { expiryDate: 'asc' }],
};

/**
 * Admin dashboard: expired / expiring trader documents across all traders (soonest first).
 * Summary counters cover every matching document, not just the current page.
 */
export const listAllExpiringDocuments = async (query: AdminExpiringDocumentsQuery) => {
  const window = query.withinDays ?? EXPIRY_REMINDER_WINDOW_DAYS;
  const today = todayInReminderZone();
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const windowEnd = new Date(today.getTime() + window * DAY_MS);
  const { page, limit, skip } = parsePageLimit(query);

  const search = query.search?.trim();
  const baseWhere: Prisma.TraderDocumentWhereInput = {
    expiryDate: { not: null, lte: windowEnd },
    status: { not: TraderDocumentStatus.REJECTED },
    ...(query.traderId ? { traderId: query.traderId } : {}),
    ...(search
      ? {
          trader: {
            OR: [
              { businessName: { contains: search, mode: 'insensitive' } },
              { user: { fullName: { contains: search, mode: 'insensitive' } } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
              { user: { mobileNumber: { contains: search } } },
            ],
          },
        }
      : {}),
  };

  const statusRange: Record<DocumentExpiryStatus, Prisma.DateTimeNullableFilter> = {
    EXPIRED: { lt: today },
    EXPIRES_TODAY: { gte: today, lt: tomorrow },
    EXPIRING_SOON: { gte: tomorrow, lte: windowEnd },
  };

  const listWhere: Prisma.TraderDocumentWhereInput = query.expiryStatus
    ? { AND: [baseWhere, { expiryDate: statusRange[query.expiryStatus] }] }
    : baseWhere;

  const countIn = (range: Prisma.DateTimeNullableFilter) =>
    prisma.traderDocument.count({ where: { AND: [baseWhere, { expiryDate: range }] } });

  const select = {
    id: true,
    documentRuleId: true,
    fileUrl: true,
    fileName: true,
    status: true,
    expiryDate: true,
    expiryReminderStage: true,
    uploadedAt: true,
    documentRule: {
      select: {
        documentKey: true,
        name: true,
        scope: true,
        categoryId: true,
        required: true,
        category: { select: { name: true } },
      },
    },
    trader: {
      select: {
        id: true,
        businessName: true,
        traderType: true,
        profilePhotoUrl: true,
        user: {
          select: { fullName: true, email: true, mobileNumber: true, profilePhotoUrl: true },
        },
      },
    },
  } satisfies Prisma.TraderDocumentSelect;

  /** Trader name (business name, else full name) and category come from optional values — ranked in memory. */
  const findPage = async () => {
    if (query.sortBy === 'traderName' || query.sortBy === 'categoryName') {
      const candidates = await prisma.traderDocument.findMany({
        where: listWhere,
        select: {
          id: true,
          uploadedAt: true,
          documentRule: { select: { category: { select: { name: true } } } },
          trader: { select: { businessName: true, user: { select: { fullName: true } } } },
        },
      });
      const ids = pageIdsByComputedKey(
        candidates.map((d) => ({
          id: d.id,
          createdAt: d.uploadedAt,
          traderName: d.trader.businessName || d.trader.user.fullName,
          categoryName: d.documentRule.category?.name ?? null,
        })),
        (r) => (query.sortBy === 'traderName' ? r.traderName : r.categoryName),
        resolveSortDir(query.sortOrder, 'asc'),
        skip,
        limit
      );
      const rows = await prisma.traderDocument.findMany({ where: { id: { in: ids } }, select });
      const byId = new Map(rows.map((r) => [r.id, r]));
      return ids.map((id) => byId.get(id)).filter((r): r is (typeof rows)[number] => Boolean(r));
    }
    return prisma.traderDocument.findMany({
      where: listWhere,
      orderBy: buildListOrderBy<Prisma.TraderDocumentOrderByWithRelationInput>(
        query.sortBy,
        query.sortOrder,
        EXPIRING_DOCUMENT_SORT_MAP,
        { sortBy: 'expiryDate', sortOrder: resolveSortDir(query.sortOrder, 'asc') },
        { id: 'asc' }
      ),
      skip,
      take: limit,
      select,
    });
  };

  const [total, docs, expiredCount, expiresTodayCount, expiringSoonCount, traderGroups] =
    await Promise.all([
      prisma.traderDocument.count({ where: listWhere }),
      findPage(),
      countIn(statusRange.EXPIRED),
      countIn(statusRange.EXPIRES_TODAY),
      countIn(statusRange.EXPIRING_SOON),
      prisma.traderDocument.groupBy({ by: ['traderId'], where: baseWhere }),
    ]);

  const items = docs.map((doc) => {
    const daysLeft = Math.round((doc.expiryDate!.getTime() - today.getTime()) / DAY_MS);
    return {
      id: doc.id,
      documentRuleId: doc.documentRuleId,
      documentKey: doc.documentRule.documentKey,
      documentName: doc.documentRule.name,
      scope: doc.documentRule.scope,
      categoryId: doc.documentRule.categoryId,
      categoryName: doc.documentRule.category?.name ?? null,
      required: doc.documentRule.required,
      fileUrl: doc.fileUrl,
      fileName: doc.fileName,
      status: doc.status,
      expiryDate: formatDocumentExpiryDate(doc.expiryDate),
      daysLeft,
      expiryStatus: expiryStatusFor(daysLeft),
      /** Last reminder stage sent to the trader (30 / 7 / 1 / 0 days), null if none yet. */
      lastReminderStage: doc.expiryReminderStage,
      uploadedAt: doc.uploadedAt,
      trader: {
        id: doc.trader.id,
        name: doc.trader.businessName || doc.trader.user.fullName,
        fullName: doc.trader.user.fullName,
        businessName: doc.trader.businessName,
        traderType: doc.trader.traderType,
        email: doc.trader.user.email,
        mobileNumber: doc.trader.user.mobileNumber,
        profilePhotoUrl: doc.trader.profilePhotoUrl ?? doc.trader.user.profilePhotoUrl ?? null,
      },
    };
  });

  return {
    summary: {
      totalDocuments: expiredCount + expiresTodayCount + expiringSoonCount,
      expiredCount,
      expiresTodayCount,
      expiringSoonCount,
      tradersAffected: traderGroups.length,
    },
    withinDays: window,
    items,
    meta: buildPaginationMeta(total, page, limit),
  };
};
