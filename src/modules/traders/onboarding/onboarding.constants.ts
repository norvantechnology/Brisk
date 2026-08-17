import { TraderType } from '@prisma/client';

export const ONBOARDING_STEPS = {
  BUSINESS_TYPE: 1,
  ENTITY_DOCUMENTS: 2,
  CATEGORIES: 3,
  CATEGORY_DOCUMENTS: 4,
  PROFILE_INFO: 5,
  BANK_DETAILS: 6,
  SERVICE_RADIUS: 7,
} as const;

export const ONBOARDING_STEP_KEYS = {
  1: 'business_type',
  2: 'entity_documents',
  3: 'categories',
  4: 'category_documents',
  5: 'profile_info',
  6: 'bank_details',
  7: 'service_radius',
} as const;

export const TOTAL_ONBOARDING_STEPS = 7;

export const getStepKey = (step: number, entityType: TraderType): string => {
  if (step === ONBOARDING_STEPS.PROFILE_INFO) {
    return entityType === TraderType.COMPANY ? 'company_info' : 'personal_info';
  }
  return ONBOARDING_STEP_KEYS[step as keyof typeof ONBOARDING_STEP_KEYS] ?? 'unknown';
};
