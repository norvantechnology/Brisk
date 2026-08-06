export interface CategoryQueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  featured?: boolean;
}

export interface SubcategoryQueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  status?: string;
  featured?: boolean;
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

export interface CreateSubcategoryInput {
  categoryId: string;
  name: string;
  serviceType?: string;
  code?: string;
  urlSlug: string;
  featured?: boolean;
  status?: string;
}

export interface UpdateSubcategoryInput {
  categoryId?: string;
  name?: string;
  serviceType?: string;
  code?: string;
  urlSlug?: string;
  featured?: boolean;
  status?: string;
}
