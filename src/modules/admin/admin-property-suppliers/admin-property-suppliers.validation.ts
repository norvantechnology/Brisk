import { z } from 'zod';

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid ID format.'),
  }),
});

export const supplierCountyParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid Supplier ID format.'),
    county: z.string().min(1, 'County is required.'),
  }),
});

export const createPropertySupplierCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Category name is required.'),
    code: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    description: z.string().optional(),
    iconUrl: z.string().optional(),
    displayOrder: z.number().int().optional().default(0),
    isActive: z.boolean().optional().default(true),
  }),
});

export const updatePropertySupplierCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid Category ID format.'),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    description: z.string().optional(),
    iconUrl: z.string().optional().nullable(),
    displayOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const categoryFilterSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    includeCounts: z.string().optional(),
    sortBy: z.enum(['displayOrder', 'name', 'createdAt']).optional().default('displayOrder'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  }),
});

export const createPropertySupplierSchema = z.object({
  body: z.object({
    categoryId: z.string().uuid('Valid Category ID is required.'),
    parentId: z.string().uuid('Parent ID must be a valid UUID.').optional().nullable(),
    name: z.string().min(1, 'Supplier name is required.'),
    slug: z.string().min(1).optional(),
    tradingName: z.string().optional().nullable(),
    logoUrl: z.string().optional().nullable(),
    iconUrl: z.string().optional().nullable(),
    websiteUrl: z.string().optional().nullable(),
    contactPhone: z.string().optional().nullable(),
    contactEmail: z.string().email('Invalid email address.').optional().nullable().or(z.literal('')),
    description: z.string().optional().nullable(),
    typicalService: z.string().optional().nullable(),
    coverageSummary: z.string().optional().nullable(),
    providesElectricity: z.boolean().optional().default(false),
    providesGas: z.boolean().optional().default(false),
    counties: z.array(z.string()).optional(),
    displayOrder: z.number().int().optional().default(0),
    isActive: z.boolean().optional().default(true),
    metadata: z.record(z.any()).optional().nullable(),
  }),
});

export const updatePropertySupplierSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid Supplier ID format.'),
  }),
  body: z.object({
    categoryId: z.string().uuid('Valid Category ID is required.').optional(),
    parentId: z.string().uuid('Parent ID must be a valid UUID.').optional().nullable(),
    name: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    tradingName: z.string().optional().nullable(),
    logoUrl: z.string().optional().nullable(),
    iconUrl: z.string().optional().nullable(),
    websiteUrl: z.string().optional().nullable(),
    contactPhone: z.string().optional().nullable(),
    contactEmail: z.string().email('Invalid email address.').optional().nullable().or(z.literal('')),
    description: z.string().optional().nullable(),
    typicalService: z.string().optional().nullable(),
    coverageSummary: z.string().optional().nullable(),
    providesElectricity: z.boolean().optional(),
    providesGas: z.boolean().optional(),
    counties: z.array(z.string()).optional(),
    displayOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
    metadata: z.record(z.any()).optional().nullable(),
  }),
});

export const supplierFilterSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    categorySlug: z.string().optional(),
    categoryCode: z.string().optional(),
    county: z.string().optional(),
    parentId: z.string().uuid().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    providesElectricity: z.enum(['true', 'false', '1', '0']).optional(),
    providesGas: z.enum(['true', 'false', '1', '0']).optional(),
    sortBy: z.enum(['displayOrder', 'name', 'createdAt', 'updatedAt']).optional().default('displayOrder'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  }),
});

export const assignCountiesSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid Supplier ID format.'),
  }),
  body: z.object({
    counties: z.array(z.string().min(1, 'County name cannot be empty.')).min(1, 'Provide at least one county.'),
  }),
});
