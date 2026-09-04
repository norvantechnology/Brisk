import { SubcategoryPriceEnteredBy } from '@prisma/client';

export interface CategoryQueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  featured?: boolean;
  sortBy?: string;
  sortOrder?: string;
}

export interface SubcategoryQueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  status?: string;
  featured?: boolean;
  sortBy?: string;
  sortOrder?: string;
}

export interface CreateCategoryInput {
  name: string;
  categoryCode: string;
  urlSlug: string;
  description?: string;
  iconName?: string;
  brandThemeColor?: string;
  bannerImageUrl?: string;
  displayOrder?: number;
  status?: string;
  featured?: boolean;
}

export interface UpdateCategoryInput {
  name?: string;
  categoryCode?: string;
  urlSlug?: string;
  description?: string;
  iconName?: string;
  brandThemeColor?: string;
  bannerImageUrl?: string;
  displayOrder?: number;
  status?: string;
  featured?: boolean;
}

export type QaFormField = {
  id: string;
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'dropdown'
    | 'single_choice'
    | 'multi_choice'
    | 'date'
    | 'boolean';
  label: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
};

export interface CreateSubcategoryInput {
  categoryId: string;
  name: string;
  serviceType?: string;
  code?: string;
  urlSlug: string;
  featured?: boolean;
  status?: string;
  siteVisitEnabled?: boolean;
  siteVisitFee?: number | null;
  priceEnabled?: boolean;
  priceEnteredBy?: SubcategoryPriceEnteredBy | 'CUSTOMER' | 'TRADER';
  qaFormSchema?: QaFormField[] | null;
}

export interface UpdateSubcategoryInput {
  categoryId?: string;
  name?: string;
  serviceType?: string;
  code?: string;
  urlSlug?: string;
  featured?: boolean;
  status?: string;
  siteVisitEnabled?: boolean;
  siteVisitFee?: number | null;
  priceEnabled?: boolean;
  priceEnteredBy?: SubcategoryPriceEnteredBy | 'CUSTOMER' | 'TRADER';
  qaFormSchema?: QaFormField[] | null;
}
