import { NotFoundError } from '../../utils/errors';

/** CMS marketing page slug for the website homepage. */
export const HOME_PAGE_SLUG = 'home';

/** URL path segment (kebab-case) → database section_key (snake_case). */
export const HOME_SECTION_BY_ROUTE: Record<string, string> = {
  hero: 'hero',
  'hero-badges': 'hero_badges',
  'job-process': 'job_process',
  'customer-workflow': 'customer_workflow',
  'connected-marketplace': 'connected_marketplace',
  'service-categories': 'service_categories',
  'why-brisk': 'why_brisk',
  customer: 'customer',
  trader: 'trader',
  statistics: 'statistics',
  'app-download': 'app_download',
};

export const resolveHomeSectionKey = (routeSegment: string): string => {
  const key = HOME_SECTION_BY_ROUTE[routeSegment];
  if (!key) {
    throw new NotFoundError(`Unknown home section: ${routeSegment}`);
  }
  return key;
};
