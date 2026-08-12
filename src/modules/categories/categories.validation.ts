import { z } from 'zod';

const paginationQuerySchema = {
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
};

export const appCategoryListSchema = z.object({
  query: z.object({
    featured: z.enum(['true', 'false']).optional(),
    includeSubcategories: z.enum(['true', 'false', '1', '0']).optional(),
    ...paginationQuerySchema,
  }),
});

export const appSubcategoryListSchema = z.object({
  query: z.object({
    categoryId: z.string().uuid().optional(),
    featured: z.enum(['true', 'false']).optional(),
    ...paginationQuerySchema,
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
