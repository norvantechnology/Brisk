import { z } from 'zod';

/** Treat missing, empty, or literal "null" as no filter (return all sub-categories). */
const optionalCategoryIdQuery = z.preprocess(
  (val) => {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'string' && ['null', 'undefined'].includes(val.trim().toLowerCase())) {
      return undefined;
    }
    return val;
  },
  z.string().uuid('categoryId must be a valid UUID.').optional()
);

export const appCategoryListSchema = z.object({
  query: z.object({
    featured: z.enum(['true', 'false']).optional(),
    includeSubcategories: z.enum(['true', 'false', '1', '0']).optional(),
  }),
});

export const appSubcategoryListSchema = z.object({
  query: z.object({
    categoryId: optionalCategoryIdQuery,
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
