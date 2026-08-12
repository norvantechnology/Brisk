import { z } from 'zod';

export const appCategoryListSchema = z.object({
  query: z.object({
    featured: z.enum(['true', 'false']).optional(),
    includeSubcategories: z.enum(['true', 'false', '1', '0']).optional(),
  }),
});

export const appSubcategoryListSchema = z.object({
  query: z.object({
    categoryId: z.string().uuid().optional(),
    featured: z.enum(['true', 'false']).optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid ID format.'),
  }),
});

export const slugParamSchema = z.object({
  params: z.object({
    slug: z.string().min(1),
  }),
});
