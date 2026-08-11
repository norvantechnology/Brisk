import { Subcategory, Category, SubcategoryPriceEnteredBy } from '@prisma/client';

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
  }
) => ({
  id: cat.id,
  name: cat.name,
  categoryCode: cat.categoryCode,
  urlSlug: cat.urlSlug,
  description: cat.description,
  iconName: cat.iconName,
  brandThemeColor: cat.brandThemeColor,
  bannerImageUrl: cat.bannerImageUrl,
  displayOrder: cat.displayOrder,
  status: cat.status,
  featured: cat.featured,
  subCategoriesCount: extras?.subCategoriesCount,
  tradersCount: extras?.tradersCount,
  jobsCount: extras?.jobsCount,
  subcategories: extras?.subcategories,
  createdAt: cat.createdAt,
  updatedAt: cat.updatedAt,
});
