import { Category, Subcategory, SubcategoryPriceEnteredBy } from '@prisma/client';

const DEFAULT_CATEGORY_ICON_BASE_URL = 'https://cdn.brisk.com/icons/categories';

const isHttpUrl = (value: string | null | undefined): value is string =>
  typeof value === 'string' && /^https?:\/\//i.test(value);

/**
 * Resolve a fetchable icon URL for mobile apps.
 * Priority: iconName (if full http URL) → CATEGORY_ICON_BASE_URL/{urlSlug}.svg → null.
 * When null, map `iconName` (e.g. Wrench) to a local asset in the app.
 */
export const resolveCategoryIconUrl = (
  cat: Pick<Category, 'iconName' | 'urlSlug'> & { bannerImageUrl?: string | null }
): string | null => {
  if (isHttpUrl(cat.iconName)) {
    return cat.iconName;
  }

  const baseUrl = (process.env.CATEGORY_ICON_BASE_URL ?? DEFAULT_CATEGORY_ICON_BASE_URL).replace(
    /\/$/,
    ''
  );

  if (cat.urlSlug) {
    return `${baseUrl}/${cat.urlSlug}.svg`;
  }

  if (isHttpUrl(cat.bannerImageUrl)) {
    return cat.bannerImageUrl;
  }

  return null;
};

/** Trader category-wise required docs status (for blue highlight when complete). */
export type CategoryDocumentsStatus = 'ACTIVE' | 'PENDING' | 'N_A';

export type CategoryDocumentsExtras = {
  /** ACTIVE = all required category docs uploaded (show blue). PENDING = missing. N_A = no required rules / guest. */
  documentsStatus: CategoryDocumentsStatus;
  /** true when documentsStatus === ACTIVE */
  documentsComplete: boolean;
  /** Alias of documentsComplete — trader mobile Profile chips. */
  documentUpload?: boolean;
  requiredDocumentsCount: number;
  uploadedRequiredDocumentsCount: number;
};

type SubcategoryRow = Pick<
  Subcategory,
  | 'id'
  | 'categoryId'
  | 'name'
  | 'serviceType'
  | 'code'
  | 'urlSlug'
  | 'featured'
  | 'status'
  | 'siteVisitEnabled'
  | 'siteVisitFee'
  | 'priceEnabled'
  | 'priceEnteredBy'
  | 'qaFormSchema'
  | 'createdAt'
  | 'updatedAt'
>;

type CategoryRow = Pick<
  Category,
  | 'id'
  | 'name'
  | 'categoryCode'
  | 'urlSlug'
  | 'description'
  | 'iconName'
  | 'brandThemeColor'
  | 'bannerImageUrl'
  | 'displayOrder'
  | 'status'
  | 'featured'
  | 'createdAt'
  | 'updatedAt'
>;

/** Consistent camelCase sub-category payload for Admin + Mobile apps. */
export const serializeSubcategory = (
  sub: SubcategoryRow,
  extras?: {
    parentCategory?: { id: string; name: string; categoryCode?: string | null };
    jobsCount?: number;
    tradersCount?: number;
    rowNumber?: number;
  }
) => ({
  id: sub.id,
  categoryId: sub.categoryId,
  name: sub.name,
  serviceType: sub.serviceType,
  code: sub.code,
  urlSlug: sub.urlSlug,
  featured: sub.featured,
  status: sub.status,
  siteVisitEnabled: sub.siteVisitEnabled,
  /** Site-visit fee from admin subcategory. Null/unset = 0 — no platform default amount. */
  siteVisitFee: sub.siteVisitFee != null ? Number(sub.siteVisitFee) : null,
  priceEnabled: sub.priceEnabled,
  /** Who fills price when priceEnabled=true. Ignore when priceEnabled=false. */
  priceEnteredBy: sub.priceEnteredBy as SubcategoryPriceEnteredBy,
  /** Admin-built Q&A form. App must render these fields when posting a job for this sub-category. */
  qaFormSchema: sub.qaFormSchema ?? [],
  parentCategory: extras?.parentCategory,
  jobsCount: extras?.jobsCount,
  tradersCount: extras?.tradersCount,
  rowNumber: extras?.rowNumber,
  createdAt: sub.createdAt,
  updatedAt: sub.updatedAt,
});

export const serializeCategory = (
  cat: CategoryRow,
  extras?: {
    subcategories?: ReturnType<typeof serializeSubcategory>[];
    subCategoriesCount?: number;
    tradersCount?: number;
    jobsCount?: number;
    documents?: CategoryDocumentsExtras;
  }
) => ({
  id: cat.id,
  name: cat.name,
  categoryCode: cat.categoryCode,
  urlSlug: cat.urlSlug,
  description: cat.description,
  iconName: cat.iconName,
  iconUrl: resolveCategoryIconUrl(cat),
  brandThemeColor: cat.brandThemeColor,
  bannerImageUrl: cat.bannerImageUrl,
  displayOrder: cat.displayOrder,
  status: cat.status,
  featured: cat.featured,
  /** ACTIVE when all required category documents are uploaded (trader Bearer). Else PENDING / N_A. */
  documentsStatus: extras?.documents?.documentsStatus ?? ('N_A' as CategoryDocumentsStatus),
  documentsComplete: extras?.documents?.documentsComplete ?? false,
  /** Same as documentsComplete — mobile Profile uses this key. */
  documentUpload: extras?.documents?.documentUpload ?? extras?.documents?.documentsComplete ?? false,
  requiredDocumentsCount: extras?.documents?.requiredDocumentsCount ?? 0,
  uploadedRequiredDocumentsCount: extras?.documents?.uploadedRequiredDocumentsCount ?? 0,
  subCategoriesCount: extras?.subCategoriesCount,
  tradersCount: extras?.tradersCount,
  jobsCount: extras?.jobsCount,
  subcategories: extras?.subcategories,
  createdAt: cat.createdAt,
  updatedAt: cat.updatedAt,
});
