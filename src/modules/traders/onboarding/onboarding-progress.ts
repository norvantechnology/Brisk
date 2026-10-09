import { TraderOnboardingStatus, TraderType } from '@prisma/client';
import { prisma } from '../../../config/database';
import { validateRequiredDocumentsUploaded } from '../../document-rules/document-rules.service';
import {
  getStepKey,
  ONBOARDING_STEPS,
  TOTAL_ONBOARDING_STEPS,
  VERIFICATION_SCREEN_DOCUMENT_KEYS,
} from './onboarding.constants';

export type OnboardingStepItem = {
  step: number;
  key: string;
  completed: boolean;
  current: boolean;
};

export type OnboardingProgress = {
  currentStep: number;
  totalSteps: number;
  currentStepKey: string;
  onboardingScreen: string;
  steps: OnboardingStepItem[];
};

type TraderProgressFields = {
  id: string;
  fullLegalName: string | null;
  ppsNumber: string | null;
  businessName: string | null;
  croNumber: string | null;
  directorFullName: string | null;
  addressLine1: string | null;
  city: string | null;
  postcode: string | null;
  bankDetailsSkipped: boolean;
  bankHolderName: string | null;
  bankName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  serviceRadiusKm: number | null;
  onboardingStatus: TraderOnboardingStatus;
  categories: { categoryId: string }[];
  documents: { documentRule: { documentKey: string } }[];
};

const profileMissing = (trader: TraderProgressFields, entityType: TraderType): boolean => {
  if (entityType === TraderType.SOLO) {
    return !trader.fullLegalName || !trader.ppsNumber || !trader.addressLine1 || !trader.city || !trader.postcode;
  }
  return (
    !trader.businessName ||
    !trader.croNumber ||
    !trader.directorFullName ||
    !trader.addressLine1 ||
    !trader.city ||
    !trader.postcode
  );
};

const isBankComplete = (trader: TraderProgressFields): boolean =>
  trader.bankDetailsSkipped ||
  Boolean(trader.bankHolderName && trader.bankName && trader.accountNumber && trader.ifscCode);

const hasDocKey = (trader: TraderProgressFields, documentKey: string): boolean =>
  trader.documents.some((d) => d.documentRule.documentKey === documentKey);

/**
 * Resolve which onboarding UI screen to show.
 * After required docs are uploaded, returns `service_radius` (last step before submit).
 */
export const resolveOnboardingScreenKey = async (
  trader: TraderProgressFields,
  entityType: TraderType | null,
  stepData: Record<string, unknown> | null,
  onboardingStatus: TraderOnboardingStatus
): Promise<string> => {
  if (
    onboardingStatus === TraderOnboardingStatus.SUBMITTED ||
    onboardingStatus === TraderOnboardingStatus.APPROVED
  ) {
    return onboardingStatus === TraderOnboardingStatus.APPROVED ? 'approved' : 'submitted';
  }

  if (!entityType || !(stepData && stepData.business_type)) {
    return 'business_verification';
  }

  const verificationDocKey = VERIFICATION_SCREEN_DOCUMENT_KEYS[entityType];
  const needsVerificationDoc =
    entityType === TraderType.COMPANY && !hasDocKey(trader, verificationDocKey);

  if (profileMissing(trader, entityType) || !isBankComplete(trader) || needsVerificationDoc) {
    return entityType === TraderType.COMPANY ? 'company_verification' : 'sole_trader_verification';
  }

  const categoryIds = trader.categories.map((c) => c.categoryId);
  if (!categoryIds.length) {
    // Profile/bank done but trade skills not chosen yet — keep document flow entry after categories.
    // Categories are selected before category docs; without them treat as still in skills/docs path.
    return entityType === TraderType.COMPANY
      ? 'company_document_verification'
      : 'sole_trader_document_verification';
  }

  const { complete } = await validateRequiredDocumentsUploaded(trader.id, entityType, categoryIds);
  if (!complete) {
    return entityType === TraderType.COMPANY
      ? 'company_document_verification'
      : 'sole_trader_document_verification';
  }

  // Docs done — last remaining onboarding UI step is service radius (then submit).
  return 'service_radius';
};

/**
 * First unfinished step from saved data (same checks as `resolveOnboardingScreenKey`), so
 * `currentStepKey` always belongs to `onboardingScreen` — also after the user navigates back.
 */
export const resolveCurrentStep = async (
  trader: TraderProgressFields,
  entityType: TraderType,
  stepData: Record<string, unknown> | null
): Promise<number> => {
  if (
    trader.onboardingStatus === TraderOnboardingStatus.SUBMITTED ||
    trader.onboardingStatus === TraderOnboardingStatus.APPROVED
  ) {
    return ONBOARDING_STEPS.SERVICE_RADIUS;
  }
  if (!(stepData && stepData.business_type)) return ONBOARDING_STEPS.BUSINESS_TYPE;
  if (profileMissing(trader, entityType)) return ONBOARDING_STEPS.PROFILE_INFO;
  if (!isBankComplete(trader)) return ONBOARDING_STEPS.BANK_DETAILS;

  const needsVerificationDoc =
    entityType === TraderType.COMPANY && !hasDocKey(trader, VERIFICATION_SCREEN_DOCUMENT_KEYS[entityType]);
  const entityDocs = await validateRequiredDocumentsUploaded(trader.id, entityType, []);
  if (needsVerificationDoc || !entityDocs.complete) return ONBOARDING_STEPS.ENTITY_DOCUMENTS;

  const categoryIds = trader.categories.map((c) => c.categoryId);
  if (!categoryIds.length) return ONBOARDING_STEPS.CATEGORIES;

  const allDocs = await validateRequiredDocumentsUploaded(trader.id, entityType, categoryIds);
  if (!allDocs.complete) return ONBOARDING_STEPS.CATEGORY_DOCUMENTS;

  return ONBOARDING_STEPS.SERVICE_RADIUS;
};

export const buildOnboardingProgress = async (params: {
  trader: TraderProgressFields;
  entityType: TraderType;
  stepData: Record<string, unknown> | null;
}): Promise<OnboardingProgress> => {
  const { trader, entityType, stepData } = params;

  const currentStep = await resolveCurrentStep(trader, entityType, stepData);
  const onboardingScreen = await resolveOnboardingScreenKey(
    trader,
    entityType,
    stepData,
    trader.onboardingStatus
  );

  const steps: OnboardingStepItem[] = Array.from({ length: TOTAL_ONBOARDING_STEPS }, (_, index) => {
    const stepNumber = index + 1;
    return {
      step: stepNumber,
      key: getStepKey(stepNumber, entityType),
      completed: stepNumber < currentStep,
      current: stepNumber === currentStep,
    };
  });

  return {
    currentStep,
    totalSteps: TOTAL_ONBOARDING_STEPS,
    currentStepKey: getStepKey(currentStep, entityType),
    onboardingScreen,
    steps,
  };
};

export const loadTraderForProgress = async (userId: string) => {
  return prisma.trader.findUnique({
    where: { userId },
    include: {
      categories: { where: { isActive: true }, select: { categoryId: true } },
      documents: {
        include: { documentRule: { select: { documentKey: true } } },
      },
    },
  });
};

export const toUpperOnboardingScreen = (screen: string): string => screen.toUpperCase();
