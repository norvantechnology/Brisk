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

const qaFormOptionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

/** Admin form-builder field saved as JSON on the sub-category. */
export const qaFormFieldSchema = z.object({
  id: z.string().min(1, 'Field id is required.'),
  type: z.enum([
    'text',
    'textarea',
    'number',
    'dropdown',
    'single_choice',
    'multi_choice',
    'date',
    'boolean',
  ]),
  label: z.string().min(1, 'Field label is required.'),
  required: z.boolean().optional().default(false),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  options: z.array(qaFormOptionSchema).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

export const qaFormSchema = z.array(qaFormFieldSchema).superRefine((fields, ctx) => {
  const ids = new Set<string>();
  fields.forEach((field, index) => {
    if (ids.has(field.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate field id "${field.id}".`,
        path: [index, 'id'],
      });
    }
    ids.add(field.id);

    const needsOptions = ['dropdown', 'single_choice', 'multi_choice'].includes(field.type);
    if (needsOptions && (!field.options || field.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Field type "${field.type}" requires at least one option.`,
        path: [index, 'options'],
      });
    }
  });
});

const subcategoryBodyBase = {
  categoryId: z.string().uuid('Invalid Category ID format.'),
  name: z.string().min(1, 'Sub-category name is required.'),
  serviceType: z.string().optional(),
  code: z.string().optional(),
  urlSlug: z.string().min(1, 'URL slug is required.'),
  featured: z.boolean().optional().default(false),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  siteVisitEnabled: z.boolean().optional().default(false),
  siteVisitFee: z.coerce.number().nonnegative().nullable().optional(),
  priceEnabled: z.boolean().optional().default(true),
  priceEnteredBy: z.enum(['CUSTOMER', 'TRADER']).optional().default('CUSTOMER'),
  qaFormSchema: qaFormSchema.optional().nullable(),
};

export const createSubcategorySchema = z.object({
  body: z.object(subcategoryBodyBase),
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
    siteVisitEnabled: z.boolean().optional(),
    siteVisitFee: z.coerce.number().nonnegative().nullable().optional(),
    priceEnabled: z.boolean().optional(),
    priceEnteredBy: z.enum(['CUSTOMER', 'TRADER']).optional(),
    qaFormSchema: qaFormSchema.optional().nullable(),
  }),
});

export const categoryFilterSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    status: z.string().optional(),
    featured: z.string().optional(),
    sortBy: z.enum(['name', 'categoryCode', 'displayOrder', 'status', 'createdAt', 'updatedAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

export const subcategoryFilterSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    categoryId: z.string().optional(),
    category_id: z.string().optional(),
    status: z.string().optional(),
    featured: z.string().optional(),
    sortBy: z.enum(['name', 'code', 'urlSlug', 'status', 'createdAt', 'updatedAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }).transform((query) => ({
    ...query,
    categoryId: query.categoryId ?? query.category_id,
  })),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid ID format.'),
  }),
});
