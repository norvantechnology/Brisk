import {
  Prisma,
  TraderOnboardingStatus,
  TraderType,
  VerificationStatus,
} from '@prisma/client';
import { prisma } from '../../../config/database';
import {
  assertDocumentRuleExists,
  getDocumentRequirementsForTrader,
  validateRequiredDocumentsUploaded,
} from '../../document-rules/document-rules.service';
import {
  BadRequestError,
  ForbiddenError,
} from '../../../utils/errors';
import {
  ONBOARDING_STEPS,
} from './onboarding.constants';
import { buildOnboardingProgress } from './onboarding-progress';
import { resolveAppNextStep } from '../../navigation/app-next-step';
import type {
  BankDetailsInput,
  BusinessTypeInput,
  CategoriesInput,
  CompanyProfileInput,
  ServiceRadiusInput,
  SoloProfileInput,
  UploadDocumentInput,
} from './onboarding.validation';

type UploadedDocRecord = {
  id: string;
  documentRuleId: string;
  fileUrl: string;
  fileName: string | null;
  status: string;
  uploadedAt: Date;
  documentRule?: {
    id: string;
    documentKey: string;
    name: string;
    scope: string;
    categoryId: string | null;
    required: boolean;
  };
};

/** Merge requirement rows with the trader's upload (one object per doc — no client-side join). */
const enrichRulesWithUploads = <T extends { id: string }>(
  rules: T[],
  documents: UploadedDocRecord[]
) => {
  const byRuleId = new Map(documents.map((doc) => [doc.documentRuleId, doc]));

  return rules.map((rule) => {
    const doc = byRuleId.get(rule.id);
    return {
      ...rule,
      uploadStatus: doc ? ('UPLOADED' as const) : ('NOT_UPLOADED' as const),
      uploadedDocument: doc
        ? {
            id: doc.id,
            fileUrl: doc.fileUrl,
            fileName: doc.fileName,
            status: doc.status,
            uploadedAt: doc.uploadedAt,
          }
        : null,
    };
  });
};

const buildDocumentRequirementsWithUploads = async (
  traderType: TraderType,
  categoryIds: string[],
  documents: UploadedDocRecord[]
) => {
  const { entityRules, categoryRules } = await getDocumentRequirementsForTrader(
    traderType,
    categoryIds
  );

  return {
    entityRules: enrichRulesWithUploads(entityRules, documents),
    // Category Wise Documents screen: one object per selected category + documents[]
    categoryRules: categoryRules.map((group) => ({
      categoryId: group.categoryId,
      categoryName: group.categoryName,
      categoryCode: group.categoryCode,
      title: group.title,
      subtitle: group.subtitle,
      documents: enrichRulesWithUploads(group.documents, documents),
    })),
  };
};
const traderInclude = {
  categories: {
    include: {
      category: { select: { id: true, name: true, categoryCode: true, iconName: true } },
    },
  },
  documents: {
    include: {
      documentRule: {
        select: {
          id: true,
          documentKey: true,
          name: true,
          scope: true,
          categoryId: true,
          required: true,
        },
      },
    },
  },
} satisfies Prisma.TraderInclude;

const assertOnboardingEditable = (trader: {
  onboardingStatus: TraderOnboardingStatus;
  verificationStatus: VerificationStatus;
}) => {
  if (
    trader.onboardingStatus === TraderOnboardingStatus.SUBMITTED ||
    trader.onboardingStatus === TraderOnboardingStatus.APPROVED
  ) {
    throw new ForbiddenError('Onboarding has already been submitted and cannot be edited.');
  }
};

const ensureTraderForUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      mobileVerified: true,
      emailVerified: true,
      fullName: true,
      email: true,
      mobileNumber: true,
      profilePhotoUrl: true,
    },
  });

  if (!user || user.role !== 'TRADER') {
    throw new ForbiddenError('Trader onboarding is only available for trader accounts.');
  }

  let trader = await prisma.trader.findUnique({
    where: { userId },
    include: traderInclude,
  });

  if (!trader) {
    trader = await prisma.trader.create({
      data: { userId },
      include: traderInclude,
    });
  }

  return { user, trader };
};

const ensureRegistration = async (userId: string, traderId: string, entityType: TraderType) => {
  const existing = await prisma.traderRegistration.findUnique({ where: { userId } });
  if (existing) {
    return existing;
  }

  return prisma.traderRegistration.create({
    data: {
      userId,
      traderId,
      entityType,
      currentStep: ONBOARDING_STEPS.BUSINESS_TYPE,
      status: 'in_progress',
      stepData: {},
    },
  });
};

const mergeStepData = (
  current: Prisma.JsonValue | null | undefined,
  stepKey: string,
  payload: unknown
): Prisma.InputJsonValue => {
  const base =
    current && typeof current === 'object' && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...base, [stepKey]: payload } as Prisma.InputJsonValue;
};

const serializeOnboardingStatus = async (
  _userId: string,
  trader: Awaited<ReturnType<typeof ensureTraderForUser>>['trader'],
  registration: { currentStep: number; entityType: TraderType; status: string; stepData: Prisma.JsonValue | null }
) => {
  const categoryIds = trader.categories.map((item) => item.categoryId);
  const documentRequirements = await buildDocumentRequirementsWithUploads(
    registration.entityType,
    categoryIds,
    trader.documents
  );
  const nextStep = await resolveAppNextStep({
    id: _userId,
    role: 'TRADER',
    mobileVerified: true,
  });

  const stepData =
    registration.stepData && typeof registration.stepData === 'object' && !Array.isArray(registration.stepData)
      ? (registration.stepData as Record<string, unknown>)
      : {};

  const progress = await buildOnboardingProgress({
    trader,
    entityType: registration.entityType,
    registrationCurrentStep: registration.currentStep,
    stepData,
  });

  // Persist advanced step when docs are done so login/status stay in sync.
  if (progress.currentStep > registration.currentStep) {
    await prisma.traderRegistration.update({
      where: { userId: _userId },
      data: { currentStep: progress.currentStep },
    });
  }

  return {
    registrationStatus: registration.status,
    onboardingStatus: trader.onboardingStatus,
    verificationStatus: trader.verificationStatus,
    entityType: registration.entityType,
    currentStep: progress.currentStep,
    totalSteps: progress.totalSteps,
    currentStepKey: progress.currentStepKey,
    nextStep,
    onboardingScreen: progress.onboardingScreen,
    steps: progress.steps,
    stepData: registration.stepData ?? {},
    selectedCategories: trader.categories.map((item) => item.category),
    documentRequirements,
    profile: {
      fullLegalName: trader.fullLegalName,
      businessName: trader.businessName,
      ppsNumber: trader.ppsNumber,
      croNumber: trader.croNumber,
      vatNumber: trader.vatNumber,
      directorFullName: trader.directorFullName,
      bio: trader.bio,
      yearsExperience: trader.yearsExperience,
      addressLine1: trader.addressLine1,
      addressLine2: trader.addressLine2,
      city: trader.city,
      postcode: trader.postcode,
      country: trader.country,
    },
    bankDetails: trader.bankDetailsSkipped
      ? { skipped: true }
      : {
          skipped: false,
          bankHolderName: trader.bankHolderName,
          bankName: trader.bankName,
          accountNumber: trader.accountNumber,
          ifscCode: trader.ifscCode,
        },
    serviceRadius: {
      serviceRadiusKm: trader.serviceRadiusKm,
      serviceRadius: trader.serviceRadius,
      serviceCenterLat: trader.serviceCenterLat ? Number(trader.serviceCenterLat) : null,
      serviceCenterLng: trader.serviceCenterLng ? Number(trader.serviceCenterLng) : null,
      serviceCenterLabel: trader.serviceCenterLabel,
    },
    user: {
      fullName: (trader as { user?: { fullName: string } }).user?.fullName ?? null,
      email: (trader as { user?: { email: string } }).user?.email ?? null,
      mobileNumber: (trader as { user?: { mobileNumber: string } }).user?.mobileNumber ?? null,
      profilePhotoUrl:
        trader.profilePhotoUrl ??
        (trader as { user?: { profilePhotoUrl: string | null } }).user?.profilePhotoUrl ??
        null,
    },
  };
};

export const getOnboardingStatus = async (userId: string) => {
  const { trader, user } = await ensureTraderForUser(userId);

  const registration = await prisma.traderRegistration.findUnique({ where: { userId } });
  if (!registration) {
    const nextStep = await resolveAppNextStep(user);
    return {
      started: false,
      nextStep,
      onboardingScreen: 'business_verification',
      onboardingStatus: trader.onboardingStatus,
      verificationStatus: trader.verificationStatus,
      message: 'Trader onboarding not started. Call POST /traders/onboarding/start when entering onboarding.',
    };
  }

  const traderWithUser = await prisma.trader.findUnique({
    where: { userId },
    include: {
      ...traderInclude,
      user: {
        select: {
          fullName: true,
          email: true,
          mobileNumber: true,
          profilePhotoUrl: true,
        },
      },
    },
  });

  return {
    started: true,
    ...(await serializeOnboardingStatus(userId, traderWithUser!, registration)),
  };
};

export const startOnboarding = async (userId: string) => {
  const { trader } = await ensureTraderForUser(userId);

  const registration = await ensureRegistration(userId, trader.id, trader.traderType);

  if (trader.onboardingStatus === TraderOnboardingStatus.NOT_STARTED) {
    await prisma.trader.update({
      where: { id: trader.id },
      data: { onboardingStatus: TraderOnboardingStatus.IN_PROGRESS },
    });
  }

  const updatedTrader = await prisma.trader.findUnique({
    where: { userId },
    include: {
      ...traderInclude,
      user: {
        select: {
          fullName: true,
          email: true,
          mobileNumber: true,
          profilePhotoUrl: true,
        },
      },
    },
  });

  return serializeOnboardingStatus(userId, updatedTrader!, registration);
};

export const saveBusinessType = async (userId: string, input: BusinessTypeInput) => {
  const { trader } = await ensureTraderForUser(userId);
  assertOnboardingEditable(trader);

  const registration = await ensureRegistration(userId, trader.id, input.entityType as TraderType);
  const entityChanged = registration.entityType !== input.entityType;

  await prisma.$transaction(async (tx) => {
    await tx.trader.update({
      where: { id: trader.id },
      data: { traderType: input.entityType as TraderType },
    });

    if (entityChanged) {
      await tx.traderCategory.deleteMany({ where: { traderId: trader.id } });
      await tx.traderDocument.deleteMany({ where: { traderId: trader.id } });
    }

    await tx.traderRegistration.update({
      where: { userId },
      data: {
        entityType: input.entityType as TraderType,
        currentStep: Math.max(registration.currentStep, ONBOARDING_STEPS.ENTITY_DOCUMENTS),
        stepData: mergeStepData(registration.stepData, 'business_type', input),
        status: 'in_progress',
      },
    });
  });

  return getOnboardingStatus(userId);
};

export const getDocumentRequirements = async (userId: string) => {
  const { trader } = await ensureTraderForUser(userId);
  const registration = await prisma.traderRegistration.findUnique({ where: { userId } });
  if (!registration) {
    throw new BadRequestError('Start onboarding first via POST /traders/onboarding/start.');
  }

  const categoryIds = trader.categories.map((item) => item.categoryId);
  const documents = await prisma.traderDocument.findMany({
    where: { traderId: trader.id },
    select: {
      id: true,
      documentRuleId: true,
      fileUrl: true,
      fileName: true,
      status: true,
      uploadedAt: true,
    },
  });

  return buildDocumentRequirementsWithUploads(registration.entityType, categoryIds, documents);
};

export const uploadDocument = async (
  userId: string,
  input: UploadDocumentInput,
  options?: { allowAfterSubmit?: boolean }
) => {
  const { trader } = await ensureTraderForUser(userId);
  if (!options?.allowAfterSubmit) {
    assertOnboardingEditable(trader);
  }

  const registration = await prisma.traderRegistration.findUnique({ where: { userId } });
  if (!registration) {
    throw new BadRequestError('Start onboarding first via POST /traders/onboarding/start.');
  }

  const rule = await assertDocumentRuleExists(input.documentRuleId);

  if (rule.scope === 'CATEGORY') {
    const selectedCategoryIds = trader.categories.map((item) => item.categoryId);
    if (!rule.categoryId || !selectedCategoryIds.includes(rule.categoryId)) {
      throw new BadRequestError('This document belongs to a category you have not selected.');
    }
  }

  if (rule.traderType && rule.traderType !== registration.entityType) {
    throw new BadRequestError('This document is not required for your business type.');
  }

  await prisma.traderDocument.upsert({
    where: {
      traderId_documentRuleId: {
        traderId: trader.id,
        documentRuleId: input.documentRuleId,
      },
    },
    create: {
      traderId: trader.id,
      documentRuleId: input.documentRuleId,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
    },
    update: {
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      status: 'PENDING',
      rejectionReason: null,
    },
  });

  if (!options?.allowAfterSubmit) {
    if (registration.currentStep === ONBOARDING_STEPS.ENTITY_DOCUMENTS) {
      const { complete } = await validateRequiredDocumentsUploaded(
        trader.id,
        registration.entityType,
        []
      );
      if (complete) {
        await prisma.traderRegistration.update({
          where: { userId },
          data: { currentStep: ONBOARDING_STEPS.CATEGORIES },
        });
      }
    } else if (registration.currentStep === ONBOARDING_STEPS.CATEGORY_DOCUMENTS) {
      const categoryIds = trader.categories.map((item) => item.categoryId);
      const { complete } = await validateRequiredDocumentsUploaded(
        trader.id,
        registration.entityType,
        categoryIds
      );
      if (complete) {
        await prisma.traderRegistration.update({
          where: { userId },
          data: { currentStep: ONBOARDING_STEPS.PROFILE_INFO },
        });
      }
    }
  }

  return getOnboardingStatus(userId);
};

export const removeDocument = async (
  userId: string,
  documentRuleId: string,
  options?: { allowAfterSubmit?: boolean }
) => {
  const { trader } = await ensureTraderForUser(userId);
  if (!options?.allowAfterSubmit) {
    assertOnboardingEditable(trader);
  }

  await prisma.traderDocument.deleteMany({
    where: { traderId: trader.id, documentRuleId },
  });

  return getOnboardingStatus(userId);
};

export const saveCategories = async (
  userId: string,
  input: CategoriesInput,
  options?: { allowAfterSubmit?: boolean }
) => {
  const { trader } = await ensureTraderForUser(userId);
  if (!options?.allowAfterSubmit) {
    assertOnboardingEditable(trader);
  }

  const registration = await ensureRegistration(userId, trader.id, trader.traderType);

  const categories = await prisma.category.findMany({
    where: { id: { in: input.categoryIds }, status: 'active' },
    select: { id: true },
  });

  if (categories.length !== input.categoryIds.length) {
    throw new BadRequestError('One or more selected categories are invalid or inactive.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.traderCategory.deleteMany({ where: { traderId: trader.id } });
    await tx.traderCategory.createMany({
      data: input.categoryIds.map((categoryId) => ({ traderId: trader.id, categoryId })),
    });

    const staleCategoryIds = trader.categories
      .map((item) => item.categoryId)
      .filter((categoryId) => !input.categoryIds.includes(categoryId));

    if (staleCategoryIds.length) {
      const staleRuleIds = await tx.documentRule.findMany({
        where: { scope: 'CATEGORY', categoryId: { in: staleCategoryIds } },
        select: { id: true },
      });

      if (staleRuleIds.length) {
        await tx.traderDocument.deleteMany({
          where: {
            traderId: trader.id,
            documentRuleId: { in: staleRuleIds.map((rule) => rule.id) },
          },
        });
      }
    }

    await tx.trader.update({
      where: { id: trader.id },
      data: { categoryId: input.categoryIds[0] },
    });

    if (!options?.allowAfterSubmit) {
      await tx.traderRegistration.update({
        where: { userId },
        data: {
          currentStep: Math.max(registration.currentStep, ONBOARDING_STEPS.CATEGORY_DOCUMENTS),
          stepData: mergeStepData(registration.stepData, 'categories', input),
        },
      });
    }
  });

  return getOnboardingStatus(userId);
};

export const saveSoloProfile = async (
  userId: string,
  input: SoloProfileInput,
  options?: { allowAfterSubmit?: boolean }
) => {
  const { trader } = await ensureTraderForUser(userId);
  if (!options?.allowAfterSubmit) {
    assertOnboardingEditable(trader);
  }

  const registration = await prisma.traderRegistration.findUnique({ where: { userId } });
  const entityType = registration?.entityType ?? trader.traderType;
  if (entityType !== TraderType.SOLO) {
    throw new BadRequestError('Personal info step is only for Sole Trader accounts.');
  }

  await prisma.trader.update({
    where: { id: trader.id },
    data: {
      fullLegalName: input.fullLegalName,
      ppsNumber: input.ppsNumber,
      bio: input.bio,
      yearsExperience: input.yearsExperience ?? 0,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      postcode: input.postcode,
      country: input.country ?? 'Ireland',
    },
  });

  if (registration && !options?.allowAfterSubmit) {
    await prisma.traderRegistration.update({
      where: { userId },
      data: {
        currentStep: Math.max(registration.currentStep, ONBOARDING_STEPS.BANK_DETAILS),
        stepData: mergeStepData(registration.stepData, 'personal_info', input),
      },
    });
  }

  return getOnboardingStatus(userId);
};

export const saveCompanyProfile = async (
  userId: string,
  input: CompanyProfileInput,
  options?: { allowAfterSubmit?: boolean }
) => {
  const { trader } = await ensureTraderForUser(userId);
  if (!options?.allowAfterSubmit) {
    assertOnboardingEditable(trader);
  }

  const registration = await prisma.traderRegistration.findUnique({ where: { userId } });
  const entityType = registration?.entityType ?? trader.traderType;
  if (entityType !== TraderType.COMPANY) {
    throw new BadRequestError('Company info step is only for Company Trader accounts.');
  }

  await prisma.trader.update({
    where: { id: trader.id },
    data: {
      businessName: input.companyName,
      croNumber: input.croNumber,
      vatNumber: input.vatNumber,
      directorFullName: input.directorFullName,
      bio: input.bio,
      yearsExperience: input.yearsExperience ?? 0,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      postcode: input.postcode,
      country: input.country ?? 'Ireland',
    },
  });

  if (registration && !options?.allowAfterSubmit) {
    await prisma.traderRegistration.update({
      where: { userId },
      data: {
        currentStep: Math.max(registration.currentStep, ONBOARDING_STEPS.BANK_DETAILS),
        stepData: mergeStepData(registration.stepData, 'company_info', input),
      },
    });
  }

  return getOnboardingStatus(userId);
};

export const saveBankDetails = async (userId: string, input: BankDetailsInput) => {
  const { trader } = await ensureTraderForUser(userId);
  assertOnboardingEditable(trader);

  const registration = await prisma.traderRegistration.findUnique({ where: { userId } });
  if (!registration) {
    throw new BadRequestError('Start onboarding first via POST /traders/onboarding/start.');
  }

  await prisma.$transaction([
    prisma.trader.update({
      where: { id: trader.id },
      data: input.skip
        ? { bankDetailsSkipped: true, bankHolderName: null, bankName: null, accountNumber: null, ifscCode: null }
        : {
            bankDetailsSkipped: false,
            bankHolderName: input.bankHolderName!,
            bankName: input.bankName!,
            accountNumber: input.accountNumber!,
            ifscCode: input.ifscCode!,
          },
    }),
    prisma.traderRegistration.update({
      where: { userId },
      data: {
        currentStep: Math.max(registration.currentStep, ONBOARDING_STEPS.SERVICE_RADIUS),
        stepData: mergeStepData(registration.stepData, 'bank_details', input),
      },
    }),
  ]);

  return getOnboardingStatus(userId);
};

export const saveServiceRadius = async (userId: string, input: ServiceRadiusInput) => {
  const { trader } = await ensureTraderForUser(userId);
  assertOnboardingEditable(trader);

  const registration = await prisma.traderRegistration.findUnique({ where: { userId } });
  if (!registration) {
    throw new BadRequestError('Start onboarding first via POST /traders/onboarding/start.');
  }

  await prisma.$transaction([
    prisma.trader.update({
      where: { id: trader.id },
      data: {
        serviceRadiusKm: input.serviceRadiusKm,
        serviceRadius: `${input.serviceRadiusKm} km`,
        serviceCenterLat: input.serviceCenterLat,
        serviceCenterLng: input.serviceCenterLng,
        serviceCenterLabel: input.serviceCenterLabel,
      },
    }),
    prisma.traderRegistration.update({
      where: { userId },
      data: {
        currentStep: ONBOARDING_STEPS.SERVICE_RADIUS,
        stepData: mergeStepData(registration.stepData, 'service_radius', input),
      },
    }),
  ]);

  return getOnboardingStatus(userId);
};

export const saveProgress = async (userId: string) => {
  const status = await getOnboardingStatus(userId);
  if (!status.started) {
    throw new BadRequestError('Start onboarding first via POST /traders/onboarding/start.');
  }
  return status;
};

const validateProfileComplete = (
  trader: Awaited<ReturnType<typeof ensureTraderForUser>>['trader'],
  entityType: TraderType
) => {
  const missing: string[] = [];

  if (entityType === TraderType.SOLO) {
    if (!trader.fullLegalName) missing.push('fullLegalName');
    if (!trader.ppsNumber) missing.push('ppsNumber');
  } else {
    if (!trader.businessName) missing.push('companyName');
    if (!trader.croNumber) missing.push('croNumber');
    if (!trader.directorFullName) missing.push('directorFullName');
  }

  if (!trader.addressLine1) missing.push('addressLine1');
  if (!trader.city) missing.push('city');
  if (!trader.postcode) missing.push('postcode');

  return missing;
};

export const submitOnboarding = async (userId: string) => {
  const { trader } = await ensureTraderForUser(userId);
  assertOnboardingEditable(trader);

  const registration = await prisma.traderRegistration.findUnique({ where: { userId } });
  if (!registration) {
    throw new BadRequestError('Start onboarding first via POST /traders/onboarding/start.');
  }

  const profileMissing = validateProfileComplete(trader, registration.entityType);
  if (profileMissing.length) {
    throw new BadRequestError(`Complete your profile information. Missing: ${profileMissing.join(', ')}`);
  }

  if (!trader.bankDetailsSkipped) {
    if (!trader.bankHolderName || !trader.bankName || !trader.accountNumber || !trader.ifscCode) {
      throw new BadRequestError('Add bank details or choose "Skip for now" before submitting.');
    }
  }

  const categoryIds = trader.categories.map((item) => item.categoryId);
  const { complete, missing } = await validateRequiredDocumentsUploaded(
    trader.id,
    registration.entityType,
    categoryIds
  );

  if (!complete) {
    throw new BadRequestError(`Upload all required documents before submitting. Missing: ${missing.join(', ')}`);
  }

  await prisma.$transaction([
    prisma.trader.update({
      where: { id: trader.id },
      data: {
        onboardingStatus: TraderOnboardingStatus.SUBMITTED,
        onboardingSubmittedAt: new Date(),
        verificationStatus: VerificationStatus.PENDING,
      },
    }),
    prisma.traderRegistration.update({
      where: { userId },
      data: {
        status: 'submitted',
        currentStep: ONBOARDING_STEPS.SERVICE_RADIUS,
      },
    }),
  ]);

  return getOnboardingStatus(userId);
};
