import {
  Prisma,
  TraderDocumentStatus,
  TraderOnboardingStatus,
  TraderType,
  VerificationStatus,
} from '@prisma/client';
import { prisma } from '../../../config/database';
import { NotFoundError, BadRequestError } from '../../../utils/errors';
import { buildListOrderBy, type SortDir } from '../../../utils/list-sort';
import { dateRangeWhere } from '../../../utils/list-filters';
import { getDocumentRequirementsForTrader } from '../../document-rules/document-rules.service';
import {
  formatDocumentExpiryDate,
  parseDocumentExpiryDate,
} from '../../document-rules/document-expiry';
import { describePersonalId } from '../../traders/personal-id';

type TraderForVerificationSync = {
  id: string;
  userId: string;
  traderType: TraderType;
  fullLegalName: string | null;
  businessName: string | null;
  ppsNumber: string | null;
  croNumber: string | null;
  directorFullName: string | null;
  addressLine1: string | null;
  city: string | null;
  postcode: string | null;
  county: string | null;
  bankDetailsSkipped: boolean;
  bankHolderName: string | null;
  bankName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  onboardingStatus: TraderOnboardingStatus;
  verificationStatus: VerificationStatus;
  rejectionReason: string | null;
  categories: Array<{ categoryId: string }>;
  documents: Array<{
    id: string;
    documentRuleId: string;
    status: TraderDocumentStatus;
    rejectionReason: string | null;
    documentRule: { required: boolean; name: string };
  }>;
  registrations: Array<{ entityType: TraderType }>;
};

/** Document-level review is allowed after approval too (new category / replaced docs). */
const DOCUMENT_REVIEWABLE_ONBOARDING_STATUSES: TraderOnboardingStatus[] = [
  TraderOnboardingStatus.SUBMITTED,
  TraderOnboardingStatus.REJECTED,
  TraderOnboardingStatus.APPROVED,
];

const isProfileComplete = (trader: TraderForVerificationSync, entityType: TraderType) => {
  if (entityType === TraderType.SOLO) {
    if (!trader.fullLegalName || !trader.ppsNumber) return false;
  } else {
    if (!trader.businessName || !trader.croNumber || !trader.directorFullName) return false;
  }
  return Boolean(trader.addressLine1 && trader.city && trader.postcode);
};

const isBankComplete = (trader: TraderForVerificationSync) =>
  trader.bankDetailsSkipped ||
  Boolean(
    trader.bankHolderName && trader.bankName && trader.accountNumber && trader.ifscCode
  );

const buildVerificationSummary = (
  requiredRules: Array<{ id: string; name: string }>,
  documents: TraderForVerificationSync['documents']
) => {
  const docsByRuleId = new Map(documents.map((doc) => [doc.documentRuleId, doc]));
  let approvedCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;
  let missingCount = 0;

  for (const rule of requiredRules) {
    const doc = docsByRuleId.get(rule.id);
    if (!doc) {
      missingCount += 1;
      continue;
    }
    if (doc.status === TraderDocumentStatus.APPROVED) approvedCount += 1;
    else if (doc.status === TraderDocumentStatus.REJECTED) rejectedCount += 1;
    else pendingCount += 1;
  }

  return {
    requiredTotal: requiredRules.length,
    approvedCount,
    pendingCount,
    rejectedCount,
    missingCount,
    allRequiredApproved:
      requiredRules.length > 0 &&
      approvedCount === requiredRules.length &&
      pendingCount === 0 &&
      rejectedCount === 0 &&
      missingCount === 0,
  };
};

/** Recompute trader verification/onboarding status from document + onboarding checks. */
export const syncTraderVerificationFromDocuments = async (traderId: string) => {
  const trader = await prisma.trader.findUnique({
    where: { id: traderId },
    include: {
      categories: { where: { isActive: true }, select: { categoryId: true } },
      documents: {
        include: { documentRule: { select: { required: true, name: true } } },
      },
      registrations: { select: { entityType: true } },
    },
  });

  if (!trader || !DOCUMENT_REVIEWABLE_ONBOARDING_STATUSES.includes(trader.onboardingStatus)) {
    return null;
  }

  const categoryIds = trader.categories.map((item) => item.categoryId);
  const requirements = await getDocumentRequirementsForTrader(trader.traderType, categoryIds);
  const requiredRules = [...requirements.entityRules, ...requirements.categoryRulesFlat].filter(
    (rule) => rule.required
  );

  const summary = buildVerificationSummary(requiredRules, trader.documents);
  const entityType = trader.registrations[0]?.entityType ?? trader.traderType;
  const profileComplete = isProfileComplete(trader, entityType);
  const bankComplete = isBankComplete(trader);

  const alreadyApproved =
    trader.onboardingStatus === TraderOnboardingStatus.APPROVED &&
    trader.verificationStatus === VerificationStatus.VERIFIED;

  let nextVerificationStatus: VerificationStatus = VerificationStatus.PENDING;
  let nextOnboardingStatus: TraderOnboardingStatus = TraderOnboardingStatus.SUBMITTED;
  let nextRejectionReason: string | null = null;
  let shouldInvalidateSessions = false;

  const rejectedRequiredDoc = trader.documents.find(
    (doc) =>
      doc.status === TraderDocumentStatus.REJECTED &&
      requiredRules.some((rule) => rule.id === doc.documentRuleId)
  );

  if (rejectedRequiredDoc) {
    nextVerificationStatus = VerificationStatus.REJECTED;
    nextOnboardingStatus = TraderOnboardingStatus.REJECTED;
    nextRejectionReason =
      rejectedRequiredDoc.rejectionReason?.trim() ||
      'One or more required documents were rejected.';
  } else if (summary.allRequiredApproved && profileComplete && bankComplete) {
    nextVerificationStatus = VerificationStatus.VERIFIED;
    nextOnboardingStatus = TraderOnboardingStatus.APPROVED;
    nextRejectionReason = null;
    shouldInvalidateSessions = trader.verificationStatus !== VerificationStatus.VERIFIED;
  } else if (alreadyApproved) {
    // Keep marketplace access while new/replaced category docs are still pending review.
    nextVerificationStatus = VerificationStatus.VERIFIED;
    nextOnboardingStatus = TraderOnboardingStatus.APPROVED;
    nextRejectionReason = null;
  } else {
    nextVerificationStatus = VerificationStatus.PENDING;
    nextOnboardingStatus = TraderOnboardingStatus.SUBMITTED;
    nextRejectionReason = null;
  }

  const statusChanged =
    trader.verificationStatus !== nextVerificationStatus ||
    trader.onboardingStatus !== nextOnboardingStatus ||
    trader.rejectionReason !== nextRejectionReason;

  if (statusChanged) {
    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.trader.update({
        where: { id: traderId },
        data: {
          verificationStatus: nextVerificationStatus,
          onboardingStatus: nextOnboardingStatus,
          rejectionReason: nextRejectionReason,
        },
      }),
      prisma.traderRegistration.updateMany({
        where: { traderId },
        data: {
          status:
            nextOnboardingStatus === TraderOnboardingStatus.APPROVED
              ? 'approved'
              : nextOnboardingStatus === TraderOnboardingStatus.REJECTED
                ? 'rejected'
                : 'submitted',
        },
      }),
    ];

    if (shouldInvalidateSessions) {
      ops.push(
        prisma.user.update({
          where: { id: trader.userId },
          data: { tokenVersion: { increment: 1 } },
        })
      );
    }

    await prisma.$transaction(ops);
  }

  // When auto-approving via document sync, notify trader once.
  if (
    statusChanged &&
    nextVerificationStatus === VerificationStatus.VERIFIED &&
    shouldInvalidateSessions
  ) {
    const user = await prisma.user.findUnique({
      where: { id: trader.userId },
      select: { id: true, fullName: true, email: true },
    });
    if (user) {
      void import('../../../services/trader-onboarding-notify.service').then(
        ({ notifyTraderProfileApproved }) =>
          notifyTraderProfileApproved({
            userId: user.id,
            fullName: user.fullName,
            email: user.email,
          })
      );
    }
  }

  return {
    verificationStatus: nextVerificationStatus,
    onboardingStatus: nextOnboardingStatus,
    rejectionReason: nextRejectionReason,
    statusChanged,
    verificationSummary: {
      ...summary,
      profileComplete,
      bankComplete,
      readyForApproval: summary.allRequiredApproved && profileComplete && bankComplete,
    },
  };
};

const serializeTraderDocument = (doc: {
  id: string;
  traderId: string;
  documentRuleId: string;
  fileUrl: string;
  fileName: string | null;
  status: TraderDocumentStatus;
  rejectionReason: string | null;
  expiryDate: Date | null;
  uploadedAt: Date;
  reviewedAt: Date | null;
  reviewedById: string | null;
  documentRule: { id: string; documentKey: string; name: string; required: boolean };
}) => ({
  id: doc.id,
  traderId: doc.traderId,
  documentRuleId: doc.documentRuleId,
  fileUrl: doc.fileUrl,
  fileName: doc.fileName,
  status: doc.status,
  rejectionReason: doc.rejectionReason,
  expiryDate: formatDocumentExpiryDate(doc.expiryDate),
  uploadedAt: doc.uploadedAt,
  reviewedAt: doc.reviewedAt,
  reviewedById: doc.reviewedById,
  documentRule: doc.documentRule,
});

export const getVerificationStats = async () => {
  const [pending, verified, rejected, submitted] = await Promise.all([
    prisma.trader.count({ where: { verificationStatus: VerificationStatus.PENDING } }),
    prisma.trader.count({ where: { verificationStatus: VerificationStatus.VERIFIED } }),
    prisma.trader.count({ where: { verificationStatus: VerificationStatus.REJECTED } }),
    prisma.trader.count({ where: { onboardingStatus: TraderOnboardingStatus.SUBMITTED } }),
  ]);

  return { pending, verified, rejected, submitted };
};

const VERIFICATION_QUEUE_SORT_MAP: Record<string, (dir: SortDir) => Prisma.TraderOrderByWithRelationInput> = {
  traderCode: (dir) => ({ traderCode: { sort: dir, nulls: 'last' } }),
  traderType: (dir) => ({ traderType: dir }),
  businessName: (dir) => ({ businessName: { sort: dir, nulls: 'last' } }),
  fullLegalName: (dir) => ({ fullLegalName: { sort: dir, nulls: 'last' } }),
  contactName: (dir) => ({ user: { fullName: dir } }),
  email: (dir) => ({ user: { email: dir } }),
  mobileNumber: (dir) => ({ user: { mobileNumber: dir } }),
  verificationStatus: (dir) => ({ verificationStatus: dir }),
  onboardingStatus: (dir) => ({ onboardingStatus: dir }),
  submittedAt: (dir) => ({ onboardingSubmittedAt: { sort: dir, nulls: 'last' } }),
};

export const listVerificationQueue = async (filters: {
  page?: string;
  limit?: string;
  status?: VerificationStatus;
  entityType?: 'SOLO' | 'COMPANY';
  onboardingStatus?: TraderOnboardingStatus;
  search?: string;
  from?: string;
  to?: string;
  sortBy?: string;
  sortOrder?: string;
}) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.TraderWhereInput = {
    onboardingStatus: filters.onboardingStatus ?? {
      in: [TraderOnboardingStatus.SUBMITTED, TraderOnboardingStatus.APPROVED, TraderOnboardingStatus.REJECTED],
    },
  };

  const submittedRange = dateRangeWhere(filters.from, filters.to);
  if (submittedRange) {
    where.onboardingSubmittedAt = submittedRange;
  }

  if (filters.status) {
    where.verificationStatus = filters.status;
  }

  if (filters.entityType) {
    where.traderType = filters.entityType;
  }

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { businessName: { contains: search, mode: 'insensitive' } },
      { fullLegalName: { contains: search, mode: 'insensitive' } },
      { traderCode: { contains: search, mode: 'insensitive' } },
      { user: { fullName: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [total, traders] = await Promise.all([
    prisma.trader.count({ where }),
    prisma.trader.findMany({
      where,
      skip,
      take: limit,
      orderBy: buildListOrderBy(
        filters.sortBy,
        filters.sortOrder,
        VERIFICATION_QUEUE_SORT_MAP,
        { sortBy: 'submittedAt', sortOrder: 'desc' },
        { id: 'asc' }
      ),
      include: {
        user: { select: { fullName: true, email: true, mobileNumber: true } },
        categories: {
          where: { isActive: true },
          include: { category: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    traders: traders.map((trader) => ({
      id: trader.id,
      traderCode: trader.traderCode,
      traderType: trader.traderType,
      businessName: trader.businessName,
      fullLegalName: trader.fullLegalName,
      verificationStatus: trader.verificationStatus,
      onboardingStatus: trader.onboardingStatus,
      onboardingSubmittedAt: trader.onboardingSubmittedAt,
      categories: trader.categories.map((item) => item.category),
      user: trader.user,
    })),
  };
};

export const getTraderVerificationDetail = async (traderId: string) => {
  const trader = await prisma.trader.findUnique({
    where: { id: traderId },
    include: {
      user: {
        select: {
          fullName: true,
          email: true,
          mobileNumber: true,
          profilePhotoUrl: true,
        },
      },
      categories: {
        where: { isActive: true },
        include: { category: { select: { id: true, name: true, categoryCode: true } } },
      },
      documents: {
        include: {
          documentRule: true,
        },
      },
      registrations: true,
    },
  });

  if (!trader) {
    throw new NotFoundError('Trader not found.');
  }

  const categoryIds = trader.categories.map((item) => item.categoryId);
  const requirements = await getDocumentRequirementsForTrader(trader.traderType, categoryIds);

  return {
    trader: {
      id: trader.id,
      traderCode: trader.traderCode,
      traderType: trader.traderType,
      businessName: trader.businessName,
      fullLegalName: trader.fullLegalName,
      ppsNumber: trader.ppsNumber,
      ...describePersonalId(trader.country),
      croNumber: trader.croNumber,
      vatNumber: trader.vatNumber,
      directorFullName: trader.directorFullName,
      bio: trader.bio,
      yearsExperience: trader.yearsExperience,
      addressLine1: trader.addressLine1,
      addressLine2: trader.addressLine2,
      city: trader.city,
      postcode: trader.postcode,
      county: trader.county,
      country: trader.country,
      bankHolderName: trader.bankHolderName,
      bankName: trader.bankName,
      accountNumber: trader.accountNumber,
      ifscCode: trader.ifscCode,
      bankDetailsSkipped: trader.bankDetailsSkipped,
      serviceRadiusKm: trader.serviceRadiusKm,
      serviceCenterLabel: trader.serviceCenterLabel,
      verificationStatus: trader.verificationStatus,
      onboardingStatus: trader.onboardingStatus,
      onboardingSubmittedAt: trader.onboardingSubmittedAt,
      rejectionReason: trader.rejectionReason,
      user: trader.user,
      categories: trader.categories.map((item) => item.category),
    },
    documents: trader.documents.map((doc) => ({
      ...doc,
      expiryDate: formatDocumentExpiryDate(doc.expiryDate),
    })),
    documentRequirements: requirements,
    registration: trader.registrations[0] ?? null,
  };
};

export const reviewTraderVerification = async (
  traderId: string,
  input: { verificationStatus: 'VERIFIED' | 'REJECTED'; rejectionReason?: string }
) => {
  const trader = await prisma.trader.findUnique({ where: { id: traderId } });
  if (!trader) {
    throw new NotFoundError('Trader not found.');
  }

  if (trader.onboardingStatus !== TraderOnboardingStatus.SUBMITTED) {
    throw new BadRequestError('Only submitted onboarding applications can be reviewed.');
  }

  const onboardingStatus =
    input.verificationStatus === 'VERIFIED'
      ? TraderOnboardingStatus.APPROVED
      : TraderOnboardingStatus.REJECTED;

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.trader.update({
      where: { id: traderId },
      data: {
        verificationStatus: input.verificationStatus as VerificationStatus,
        onboardingStatus,
        rejectionReason: input.verificationStatus === 'REJECTED' ? input.rejectionReason : null,
      },
    }),
    prisma.traderRegistration.updateMany({
      where: { traderId },
      data: {
        status: input.verificationStatus === 'VERIFIED' ? 'approved' : 'rejected',
      },
    }),
  ];

  if (input.verificationStatus === 'VERIFIED') {
    ops.push(
      prisma.user.update({
        where: { id: trader.userId },
        data: { tokenVersion: { increment: 1 } },
      })
    );
  }

  await prisma.$transaction(ops);

  if (input.verificationStatus === 'VERIFIED') {
    const user = await prisma.user.findUnique({
      where: { id: trader.userId },
      select: { id: true, fullName: true, email: true },
    });
    if (user) {
      void import('../../../services/trader-onboarding-notify.service').then(
        ({ notifyTraderProfileApproved }) =>
          notifyTraderProfileApproved({
            userId: user.id,
            fullName: user.fullName,
            email: user.email,
          })
      );
    }
  } else if (input.verificationStatus === 'REJECTED') {
    const user = await prisma.user.findUnique({
      where: { id: trader.userId },
      select: { id: true, fullName: true, email: true },
    });
    if (user) {
      void import('../../../services/trader-onboarding-notify.service').then(
        ({ notifyTraderProfileRejected }) =>
          notifyTraderProfileRejected({
            userId: user.id,
            fullName: user.fullName,
            email: user.email,
            reason: input.rejectionReason,
          })
      );
    }
  }

  return getTraderVerificationDetail(traderId);
};

export const reviewTraderDocument = async (
  traderId: string,
  documentId: string,
  adminId: string,
  input: {
    status?: typeof TraderDocumentStatus.APPROVED | typeof TraderDocumentStatus.REJECTED;
    rejectionReason?: string;
    expiryDate?: string | null;
  }
) => {
  const trader = await prisma.trader.findUnique({
    where: { id: traderId },
    select: {
      id: true,
      userId: true,
      onboardingStatus: true,
      verificationStatus: true,
      rejectionReason: true,
    },
  });
  if (!trader) {
    throw new NotFoundError('Trader not found.');
  }

  if (input.status && !DOCUMENT_REVIEWABLE_ONBOARDING_STATUSES.includes(trader.onboardingStatus)) {
    throw new BadRequestError(
      'Documents can only be reviewed when onboarding is SUBMITTED, REJECTED, or APPROVED (verified traders with new/replaced docs).'
    );
  }

  const document = await prisma.traderDocument.findFirst({
    where: { id: documentId, traderId },
    include: {
      documentRule: {
        select: { id: true, documentKey: true, name: true, required: true },
      },
    },
  });
  if (!document) {
    throw new NotFoundError('Document not found for this trader.');
  }

  const data: Prisma.TraderDocumentUpdateInput = {};
  if (input.expiryDate !== undefined) {
    data.expiryDate = parseDocumentExpiryDate(input.expiryDate);
    data.expiryReminderStage = null;
  }
  if (input.status) {
    data.status = input.status;
    data.rejectionReason =
      input.status === TraderDocumentStatus.REJECTED ? input.rejectionReason ?? null : null;
    data.reviewedAt = new Date();
    data.reviewedById = adminId;
  }

  const updatedDocument = await prisma.traderDocument.update({
    where: { id: documentId },
    data,
    include: {
      documentRule: {
        select: { id: true, documentKey: true, name: true, required: true },
      },
    },
  });

  // Expiry-date correction only — no review, status sync, or trader notification.
  if (!input.status) {
    return {
      document: serializeTraderDocument(updatedDocument),
      trader: {
        id: traderId,
        verificationStatus: trader.verificationStatus,
        onboardingStatus: trader.onboardingStatus,
        rejectionReason: trader.rejectionReason,
        statusChanged: false,
      },
      verificationSummary: null,
    };
  }

  const reviewStatus = input.status;
  const syncResult = await syncTraderVerificationFromDocuments(traderId);

  const traderUser = await prisma.user.findUnique({
    where: { id: trader.userId },
    select: { id: true, email: true, fullName: true },
  });

  if (traderUser?.email) {
    void import('../../../services/trader-onboarding-notify.service').then(
      ({ notifyTraderDocumentReviewed }) =>
        notifyTraderDocumentReviewed({
          userId: traderUser.id,
          email: traderUser.email,
          fullName: traderUser.fullName,
          documentId: updatedDocument.id,
          documentName: updatedDocument.documentRule.name,
          status: reviewStatus,
          rejectionReason: updatedDocument.rejectionReason,
        })
    );
  }

  return {
    document: serializeTraderDocument(updatedDocument),
    trader: {
      id: traderId,
      verificationStatus: syncResult?.verificationStatus ?? trader.verificationStatus,
      onboardingStatus: syncResult?.onboardingStatus ?? trader.onboardingStatus,
      rejectionReason: syncResult?.rejectionReason ?? trader.rejectionReason,
      statusChanged: syncResult?.statusChanged ?? false,
    },
    verificationSummary: syncResult?.verificationSummary ?? null,
  };
};
