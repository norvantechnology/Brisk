export interface PropertySupplierCategoryDto {
  id: string;
  name: string;
  slug: string;
  code: string;
  description: string | null;
  iconUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  suppliersCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePropertySupplierCategoryInput {
  name: string;
  code?: string;
  slug?: string;
  description?: string;
  iconUrl?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpdatePropertySupplierCategoryInput {
  name?: string;
  code?: string;
  slug?: string;
  description?: string;
  iconUrl?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface PropertySupplierDto {
  id: string;
  categoryId: string;
  category?: {
    id: string;
    name: string;
    code: string;
    slug: string;
  };
  parentId: string | null;
  parent?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  children?: Array<{
    id: string;
    name: string;
    slug: string;
    tradingName?: string | null;
  }>;
  name: string;
  slug: string;
  tradingName: string | null;
  logoUrl: string | null;
  iconUrl: string | null;
  websiteUrl: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  description: string | null;
  typicalService: string | null;
  coverageSummary: string | null;
  providesElectricity: boolean;
  providesGas: boolean;
  displayOrder: number;
  isActive: boolean;
  counties: string[];
  metadata: any | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePropertySupplierInput {
  categoryId: string;
  parentId?: string;
  name: string;
  slug?: string;
  tradingName?: string;
  logoUrl?: string;
  iconUrl?: string;
  websiteUrl?: string;
  contactPhone?: string;
  contactEmail?: string;
  description?: string;
  typicalService?: string;
  coverageSummary?: string;
  providesElectricity?: boolean;
  providesGas?: boolean;
  counties?: string[];
  displayOrder?: number;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdatePropertySupplierInput {
  categoryId?: string;
  parentId?: string | null;
  name?: string;
  slug?: string;
  tradingName?: string;
  logoUrl?: string;
  iconUrl?: string;
  websiteUrl?: string;
  contactPhone?: string;
  contactEmail?: string;
  description?: string;
  typicalService?: string;
  coverageSummary?: string;
  providesElectricity?: boolean;
  providesGas?: boolean;
  counties?: string[];
  displayOrder?: number;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface ListPropertySuppliersQuery {
  page?: string | number;
  limit?: string | number;
  search?: string;
  categoryId?: string;
  categorySlug?: string;
  categoryCode?: string;
  county?: string;
  parentId?: string;
  status?: 'active' | 'inactive';
  providesElectricity?: string | boolean;
  providesGas?: string | boolean;
  sortBy?: 'displayOrder' | 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface CountyCoverageOverviewItem {
  county: string;
  collectorsCount: number;
  collectors: Array<{
    id: string;
    name: string;
    slug: string;
    tradingName?: string | null;
    logoUrl?: string | null;
  }>;
}
