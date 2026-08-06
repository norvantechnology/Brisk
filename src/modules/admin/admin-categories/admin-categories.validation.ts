import { z } from 'zod';

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Category name is required.'),
    categoryCode: z.string().min(1, 'Category code is required.'),
    urlSlug: z.string().min(1, 'URL slug is required.'),
    description: z.string().optional(),
    iconName: z.string().optional(),
    brandThemeColor: z.string().optional(),
    bannerImageUrl: z.string().optional(),
    displayOrder: z.number().int().optional().default(0),
    status: z.enum(['active', 'inactive']).optional().default('active'),
    featured: z.boolean().optional().default(false),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid Category ID format.'),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    categoryCode: z.string().min(1).optional(),
    urlSlug: z.string().min(1).optional(),
    description: z.string().optional(),
    iconName: z.string().optional(),
    brandThemeColor: z.string().optional(),
    bannerImageUrl: z.string().optional(),
    displayOrder: z.number().int().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    featured: z.boolean().optional(),
  }),
});

export const createSubcategorySchema = z.object({
  body: z.object({
    categoryId: z.string().uuid('Invalid Category ID format.'),
    name: z.string().min(1, 'Sub-category name is required.'),
    serviceType: z.string().optional(),
    code: z.string().optional(),
    urlSlug: z.string().min(1, 'URL slug is required.'),
    featured: z.boolean().optional().default(false),
    status: z.enum(['active', 'inactive']).optional().default('active'),
  }),
});

export const updateSubcategorySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid Sub-category ID format.'),
  }),
  body: z.object({
    categoryId: z.string().uuid().optional(),
    name: z.string().min(1).optional(),
    serviceType: z.string().optional(),
    code: z.string().optional(),
    urlSlug: z.string().min(1).optional(),
    featured: z.boolean().optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }),
});

export const categoryFilterSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    status: z.string().optional(),
    featured: z.string().optional(),
  }),
});

export const subcategoryFilterSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    categoryId: z.string().optional(),
    status: z.string().optional(),
    featured: z.string().optional(),
  }),
});
