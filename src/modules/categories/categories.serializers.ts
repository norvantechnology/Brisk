import { Category, Subcategory, SubcategoryPriceEnteredBy } from '@prisma/client';

const DEFAULT_CATEGORY_ICON_BASE_URL = 'https://cdn.brisk.com/icons/categories';

const isHttpUrl = (value: string | null | undefined): boolean =>
  typeof value === 'string' && /^https?:\/\//i.test(value);

/**
 * Resolve a fetchable icon URL for mobile apps.
 * Priority: iconName (if full http URL) → CATEGORY_ICON_BASE_URL/{urlSlug}.svg → null.
 * When null, map `iconName` (e.g. Wrench) to a local asset in the app.
 */
export const resolveCategoryIconUrl = (
  cat: Pick<Category, 'iconName' | 'urlSlug'> & { bannerImageUrl?: string | null }
): string | null => {
  const icon = cat.iconName;
  if (typeof icon === 'string') {
    if (isHttpUrl(icon)) {
      return icon;
    }
    if (icon.startsWith('/')) {
      const publicBase = (
        process.env.UPLOAD_PUBLIC_BASE_URL ||
        process.env.PUBLIC_API_URL ||
        'http://104.207.88.181:3000'
      ).replace(/\/$/, '');
      return `${publicBase}${icon}`;
    }
  }

  const baseUrl = (process.env.CATEGORY_ICON_BASE_URL ?? DEFAULT_CATEGORY_ICON_BASE_URL).replace(
    /\/$/,
    ''
  );

  if (cat.urlSlug) {
    return `${baseUrl}/${cat.urlSlug}.svg`;
  }

  if (isHttpUrl(cat.bannerImageUrl)) {
    return cat.bannerImageUrl ?? null;
  }

  return null;
};

const DEFAULT_SUBCATEGORY_ICON_BASE_URL = 'https://cdn.brisk.com/icons/subcategories';

/**
 * Resolve a fetchable icon URL for subcategories.
 * Priority: iconUrl (if full URL or absolute path) → imageUrl → SUBCATEGORY_ICON_BASE_URL/{urlSlug}.svg → null.
 */
export const resolveSubcategoryIconUrl = (
  sub: {
    urlSlug?: string | null;
    iconUrl?: string | null;
    imageUrl?: string | null;
    bannerImageUrl?: string | null;
  }
): string | null => {
  const icon = sub.iconUrl;
  if (typeof icon === 'string' && icon.trim()) {
    if (isHttpUrl(icon)) {
      return icon;
    }
    if (icon.startsWith('/')) {
      const publicBase = (
        process.env.UPLOAD_PUBLIC_BASE_URL ||
        process.env.PUBLIC_API_URL ||
        'http://104.207.88.181:3000'
      ).replace(/\/$/, '');
      return `${publicBase}${icon}`;
    }
  }

  const img = sub.imageUrl;
  if (typeof img === 'string' && img.trim()) {
    if (isHttpUrl(img)) {
      return img;
    }
    if (img.startsWith('/')) {
      const publicBase = (
        process.env.UPLOAD_PUBLIC_BASE_URL ||
        process.env.PUBLIC_API_URL ||
        'http://104.207.88.181:3000'
      ).replace(/\/$/, '');
      return `${publicBase}${img}`;
    }
  }

  const baseUrl = (
    process.env.SUBCATEGORY_ICON_BASE_URL ??
    (process.env.CATEGORY_ICON_BASE_URL
      ? `${process.env.CATEGORY_ICON_BASE_URL.replace(/\/$/, '')}/subcategories`
      : DEFAULT_SUBCATEGORY_ICON_BASE_URL)
  ).replace(/\/$/, '');

  if (sub.urlSlug) {
    return `${baseUrl}/${sub.urlSlug}.svg`;
  }

  if (isHttpUrl(sub.bannerImageUrl)) {
    return sub.bannerImageUrl ?? null;
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
  | 'imageUrl'
  | 'bannerImageUrl'
  | 'iconUrl'
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
  imageUrl: sub.imageUrl ?? null,
  bannerImageUrl: sub.bannerImageUrl ?? null,
  iconUrl: resolveSubcategoryIconUrl(sub),
  siteVisitEnabled: sub.siteVisitEnabled,
  /** Site-visit fee set on this subcategory. Null = not set; job form falls back to admin setting `site_visit.default_fee`. */
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
