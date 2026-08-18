import { TraderOnboardingStatus, UserRole } from '@prisma/client';
import { prisma } from '../../config/database';

/** App-level navigation keys returned by auth and onboarding status APIs. */
export const APP_NEXT_STEP = {
  VERIFY_PHONE: 'VERIFY_PHONE',
  TRADER_ONBOARDING: 'TRADER_ONBOARDING',
  TRADER_PENDING_APPROVAL: 'TRADER_PENDING_APPROVAL',
  TRADER_HOME: 'TRADER_HOME',
  CUSTOMER_HOME: 'CUSTOMER_HOME',
} as const;

export type AppNextStep = (typeof APP_NEXT_STEP)[keyof typeof APP_NEXT_STEP];

/** Onboarding screen keys used inside the TRADER_ONBOARDING flow. */
export const ONBOARDING_SCREEN = {
  BUSINESS_VERIFICATION: 'BUSINESS_VERIFICATION',
  SOLE_TRADER_VERIFICATION: 'SOLE_TRADER_VERIFICATION',
  COMPANY_VERIFICATION: 'COMPANY_VERIFICATION',
  SOLE_TRADER_DOCUMENT_VERIFICATION: 'SOLE_TRADER_DOCUMENT_VERIFICATION',
  COMPANY_DOCUMENT_VERIFICATION: 'COMPANY_DOCUMENT_VERIFICATION',
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
  onboardingScreen: OnboardingScreen;
  entityType: string | null;
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

const resolveOnboardingScreen = async (
  userId: string,
  entityType: string | null
): Promise<OnboardingScreen> => {
  if (!entityType) return ONBOARDING_SCREEN.BUSINESS_VERIFICATION;

  const trader = await prisma.trader.findUnique({
    where: { userId },
    include: {
      documents: {
        include: { documentRule: { select: { documentKey: true } } },
      },
    },
  });

  if (!trader) return ONBOARDING_SCREEN.BUSINESS_VERIFICATION;

  const uploadedKeys = trader.documents.map((d) => d.documentRule.documentKey);
  const verificationDocKey = entityType === 'COMPANY' ? 'director_photo_id' : 'driving_license';
  const hasVerificationDoc = uploadedKeys.includes(verificationDocKey);

  const profileMissing =
    entityType === 'SOLO'
      ? !trader.fullLegalName || !trader.ppsNumber || !trader.addressLine1
      : !trader.businessName || !trader.croNumber || !trader.directorFullName || !trader.addressLine1;

  const bankDone =
    trader.bankDetailsSkipped ||
    Boolean(trader.bankHolderName && trader.bankName && trader.accountNumber && trader.ifscCode);

  if (profileMissing || !bankDone || !hasVerificationDoc) {
    return entityType === 'COMPANY'
      ? ONBOARDING_SCREEN.COMPANY_VERIFICATION
      : ONBOARDING_SCREEN.SOLE_TRADER_VERIFICATION;
  }

  return entityType === 'COMPANY'
    ? ONBOARDING_SCREEN.COMPANY_DOCUMENT_VERIFICATION
    : ONBOARDING_SCREEN.SOLE_TRADER_DOCUMENT_VERIFICATION;
};

const buildTraderOnboardingSnapshot = async (userId: string): Promise<TraderOnboardingSnapshot> => {
  const registration = await prisma.traderRegistration.findUnique({ where: { userId } });
  const entityType = registration?.entityType ?? null;

  const onboardingScreen = await resolveOnboardingScreen(userId, entityType ? String(entityType) : null);

  const trader = await prisma.trader.findUnique({
    where: { userId },
    include: {
      documents: {
        include: { documentRule: { select: { documentKey: true } } },
      },
    },
  });

  return {
    onboardingScreen,
    entityType: entityType ? String(entityType) : null,
    profile: {
      fullLegalName: trader?.fullLegalName ?? null,
      ppsNumber: trader?.ppsNumber ?? null,
      companyName: trader?.businessName ?? null,
      croNumber: trader?.croNumber ?? null,
      vatNumber: trader?.vatNumber ?? null,
      directorFullName: trader?.directorFullName ?? null,
      addressLine1: trader?.addressLine1 ?? null,
      city: trader?.city ?? null,
      postcode: trader?.postcode ?? null,
    },
    bankDetails: trader?.bankDetailsSkipped
      ? { skipped: true, bankHolderName: null, bankName: null, accountNumber: null, ifscCode: null }
      : {
          skipped: false,
          bankHolderName: trader?.bankHolderName ?? null,
          bankName: trader?.bankName ?? null,
          accountNumber: trader?.accountNumber ?? null,
          ifscCode: trader?.ifscCode ?? null,
        },
    uploadedDocumentKeys: trader?.documents.map((d) => d.documentRule.documentKey) ?? [],
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

  // APPROVED
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
