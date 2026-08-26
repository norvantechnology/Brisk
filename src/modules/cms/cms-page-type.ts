import { CmsTestimonialPageType } from '@prisma/client';

/** Accepts enum values and frontend aliases (e.g. aboutUs → ABOUT_US). */
export const parseCmsPageType = (
  value?: string | null
): CmsTestimonialPageType | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase().replace(/[-_\s]/g, '');

  if (normalized === 'customer') return CmsTestimonialPageType.CUSTOMER;
  if (normalized === 'trader') return CmsTestimonialPageType.TRADER;
  if (normalized === 'home') return CmsTestimonialPageType.HOME;
  if (normalized === 'aboutus') return CmsTestimonialPageType.ABOUT_US;

  const upper = value.trim().toUpperCase();
  if (Object.values(CmsTestimonialPageType).includes(upper as CmsTestimonialPageType)) {
    return upper as CmsTestimonialPageType;
  }
  return undefined;
};

/** Public/API-friendly pageType string (ABOUT_US → aboutUs). */
export const toApiPageType = (pageType: CmsTestimonialPageType): string => {
  if (pageType === CmsTestimonialPageType.ABOUT_US) return 'aboutUs';
  return pageType.toLowerCase();
};
