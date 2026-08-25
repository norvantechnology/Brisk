import { TraderOnboardingStatus, TraderType, UserRole } from '@prisma/client';
import { prisma } from '../../config/database';
import {
  buildOnboardingProgress,
  toUpperOnboardingScreen,
} from '../traders/onboarding/onboarding-progress';

/** App-level navigation keys returned by auth and onboarding status APIs. */
export const APP_NEXT_STEP = {
  VERIFY_PHONE: 'VERIFY_PHONE',
  TRADER_ONBOARDING: 'TRADER_ONBOARDING',
  TRADER_PENDING_APPROVAL: 'TRADER_PENDING_APPROVAL',
  TRADER_HOME: 'TRADER_HOME',
  CUSTOMER_HOME: 'CUSTOMER_HOME',
} as const;

export type AppNextStep = (typeof APP_NEXT_STEP)[keyof typeof APP_NEXT_STEP];

/** Onboarding screen keys used inside the TRADER_ONBOARDING flow (uppercase for login). */
export const ONBOARDING_SCREEN = {
  BUSINESS_VERIFICATION: 'BUSINESS_VERIFICATION',
  SOLE_TRADER_VERIFICATION: 'SOLE_TRADER_VERIFICATION',
  COMPANY_VERIFICATION: 'COMPANY_VERIFICATION',
  SOLE_TRADER_DOCUMENT_VERIFICATION: 'SOLE_TRADER_DOCUMENT_VERIFICATION',
  COMPANY_DOCUMENT_VERIFICATION: 'COMPANY_DOCUMENT_VERIFICATION',
  SERVICE_RADIUS: 'SERVICE_RADIUS',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
} as const;

export type OnboardingScreen = (typeof ONBOARDING_SCREEN)[keyof typeof ONBOARDING_SCREEN];

export type SessionExtras = {
  nextStep: AppNextStep;
  /** true only when trader is fully approved and can use all app features */
  traderAccountActive: boolean;
  onboarding: TraderOnboardingSnapshot | null;
};

export type TraderOnboardingSnapshot = {
  onboardingScreen: OnboardingScreen | string;
  entityType: string | null;
  currentStep: number;
  totalSteps: number;
  currentStepKey: string;
  steps: Array<{ step: number; key: string; completed: boolean; current: boolean }>;
  /** Profile fields saved so far — use to pre-fill forms */
  profile: {
    fullLegalName: string | null;
    ppsNumber: string | null;
    companyName: string | null;
    croNumber: string | null;
    vatNumber: string | null;
    directorFullName: string | null;
    addressLine1: string | null;
    city: string | null;
    postcode: string | null;
  };
  bankDetails: {
    skipped: boolean;
    bankHolderName: string | null;
    bankName: string | null;
    accountNumber: string | null;
    ifscCode: string | null;
  };
  /** IDs of uploaded documents — use to show already-uploaded file chips */
  uploadedDocumentKeys: string[];
};

const buildTraderOnboardingSnapshot = async (userId: string): Promise<TraderOnboardingSnapshot> => {
  const registration = await prisma.traderRegistration.findUnique({ where: { userId } });
  const entityType = (registration?.entityType as TraderType | null) ?? null;

  const trader = await prisma.trader.findUnique({
    where: { userId },
    include: {
      categories: { select: { categoryId: true } },
      documents: {
        include: { documentRule: { select: { documentKey: true } } },
      },
    },
  });

  if (!trader || !entityType || !registration) {
    return {
      onboardingScreen: ONBOARDING_SCREEN.BUSINESS_VERIFICATION,
      entityType: entityType ? String(entityType) : null,
      currentStep: 1,
      totalSteps: 7,
      currentStepKey: 'business_type',
      steps: Array.from({ length: 7 }, (_, i) => ({
        step: i + 1,
        key:
          i + 1 === 1
            ? 'business_type'
            : i + 1 === 2
              ? 'entity_documents'
              : i + 1 === 3
                ? 'categories'
                : i + 1 === 4
                  ? 'category_documents'
                  : i + 1 === 5
                    ? 'personal_info'
                    : i + 1 === 6
                      ? 'bank_details'
                      : 'service_radius',
        completed: false,
        current: i === 0,
      })),
      profile: {
        fullLegalName: null,
        ppsNumber: null,
        companyName: null,
        croNumber: null,
        vatNumber: null,
        directorFullName: null,
        addressLine1: null,
        city: null,
        postcode: null,
      },
      bankDetails: {
        skipped: false,
        bankHolderName: null,
        bankName: null,
        accountNumber: null,
        ifscCode: null,
      },
      uploadedDocumentKeys: [],
    };
  }

  const stepData =
    registration.stepData && typeof registration.stepData === 'object' && !Array.isArray(registration.stepData)
      ? (registration.stepData as Record<string, unknown>)
      : {};

  const progress = await buildOnboardingProgress({
    trader,
    entityType,
    registrationCurrentStep: registration.currentStep,
    stepData,
  });

  if (progress.currentStep > registration.currentStep) {
    await prisma.traderRegistration.update({
      where: { userId },
      data: { currentStep: progress.currentStep },
    });
  }

  return {
    onboardingScreen: toUpperOnboardingScreen(progress.onboardingScreen),
    entityType: String(entityType),
    currentStep: progress.currentStep,
    totalSteps: progress.totalSteps,
    currentStepKey: progress.currentStepKey,
    steps: progress.steps,
    profile: {
      fullLegalName: trader.fullLegalName ?? null,
      ppsNumber: trader.ppsNumber ?? null,
      companyName: trader.businessName ?? null,
      croNumber: trader.croNumber ?? null,
      vatNumber: trader.vatNumber ?? null,
      directorFullName: trader.directorFullName ?? null,
      addressLine1: trader.addressLine1 ?? null,
      city: trader.city ?? null,
      postcode: trader.postcode ?? null,
    },
    bankDetails: trader.bankDetailsSkipped
      ? { skipped: true, bankHolderName: null, bankName: null, accountNumber: null, ifscCode: null }
      : {
          skipped: false,
          bankHolderName: trader.bankHolderName ?? null,
          bankName: trader.bankName ?? null,
          accountNumber: trader.accountNumber ?? null,
          ifscCode: trader.ifscCode ?? null,
        },
    uploadedDocumentKeys: trader.documents.map((d) => d.documentRule.documentKey),
  };
};

const resolveTraderNextStep = async (userId: string): Promise<SessionExtras> => {
  const trader = await prisma.trader.findUnique({
    where: { userId },
    select: { onboardingStatus: true, verificationStatus: true },
  });

  if (
    !trader ||
    trader.onboardingStatus === TraderOnboardingStatus.NOT_STARTED ||
    trader.onboardingStatus === TraderOnboardingStatus.IN_PROGRESS ||
    trader.onboardingStatus === TraderOnboardingStatus.REJECTED
  ) {
    const onboarding = await buildTraderOnboardingSnapshot(userId);
    return { nextStep: APP_NEXT_STEP.TRADER_ONBOARDING, traderAccountActive: false, onboarding };
  }

  if (trader.onboardingStatus === TraderOnboardingStatus.SUBMITTED) {
    return { nextStep: APP_NEXT_STEP.TRADER_PENDING_APPROVAL, traderAccountActive: false, onboarding: null };
  }

  return { nextStep: APP_NEXT_STEP.TRADER_HOME, traderAccountActive: true, onboarding: null };
};

export const resolveAppNextStep = async (user: {
  id: string;
  role: UserRole | string;
  mobileVerified: boolean;
}): Promise<AppNextStep> => {
  if (!user.mobileVerified) return APP_NEXT_STEP.VERIFY_PHONE;
  if (user.role === UserRole.TRADER) {
    const { nextStep } = await resolveTraderNextStep(user.id);
    return nextStep;
  }
  return APP_NEXT_STEP.CUSTOMER_HOME;
};

export const resolveSessionExtras = async (user: {
  id: string;
  role: UserRole | string;
  mobileVerified: boolean;
}): Promise<SessionExtras> => {
  if (!user.mobileVerified) {
    return { nextStep: APP_NEXT_STEP.VERIFY_PHONE, traderAccountActive: false, onboarding: null };
  }
  if (user.role === UserRole.TRADER) {
    return resolveTraderNextStep(user.id);
  }
  return { nextStep: APP_NEXT_STEP.CUSTOMER_HOME, traderAccountActive: false, onboarding: null };
};
