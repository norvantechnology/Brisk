import { TraderType } from '@prisma/client';

/** Same order as the app screens: Business → Personal/Company info + bank → Documents (+ trade skills) → Service radius. */
export const ONBOARDING_STEPS = {
  BUSINESS_TYPE: 1,
  PROFILE_INFO: 2,
  BANK_DETAILS: 3,
  ENTITY_DOCUMENTS: 4,
  CATEGORIES: 5,
  CATEGORY_DOCUMENTS: 6,
  SERVICE_RADIUS: 7,
} as const;

export const ONBOARDING_STEP_KEYS = {
  1: 'business_type',
  2: 'profile_info',
  3: 'bank_details',
  4: 'entity_documents',
  5: 'categories',
  6: 'category_documents',
  7: 'service_radius',
} as const;

export const TOTAL_ONBOARDING_STEPS = 7;

/** Entity document keys shown on the Sole/Company Verification screen (not Document Verification). */
export const VERIFICATION_SCREEN_DOCUMENT_KEYS: Record<TraderType, string> = {
  [TraderType.SOLO]: 'driving_license',
  [TraderType.COMPANY]: 'director_photo_id',
};

export const getStepKey = (step: number, entityType: TraderType): string => {
  if (step === ONBOARDING_STEPS.PROFILE_INFO) {
    return entityType === TraderType.COMPANY ? 'company_info' : 'personal_info';
  }
  return ONBOARDING_STEP_KEYS[step as keyof typeof ONBOARDING_STEP_KEYS] ?? 'unknown';
};
