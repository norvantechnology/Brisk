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

const resolveTraderNextStep = async (userId: string): Promise<AppNextStep> => {
  const trader = await prisma.trader.findUnique({
    where: { userId },
    select: { onboardingStatus: true },
  });

  if (
    !trader ||
    trader.onboardingStatus === TraderOnboardingStatus.NOT_STARTED ||
    trader.onboardingStatus === TraderOnboardingStatus.IN_PROGRESS ||
    trader.onboardingStatus === TraderOnboardingStatus.REJECTED
  ) {
    return APP_NEXT_STEP.TRADER_ONBOARDING;
  }

  if (trader.onboardingStatus === TraderOnboardingStatus.SUBMITTED) {
    return APP_NEXT_STEP.TRADER_PENDING_APPROVAL;
  }

  return APP_NEXT_STEP.TRADER_HOME;
};

export const resolveAppNextStep = async (user: {
  id: string;
  role: UserRole | string;
  mobileVerified: boolean;
}): Promise<AppNextStep> => {
  if (!user.mobileVerified) {
    return APP_NEXT_STEP.VERIFY_PHONE;
  }

  if (user.role === UserRole.TRADER) {
    return resolveTraderNextStep(user.id);
  }

  return APP_NEXT_STEP.CUSTOMER_HOME;
};
