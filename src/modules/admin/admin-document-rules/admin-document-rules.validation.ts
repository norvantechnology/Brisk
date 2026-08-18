import { z } from 'zod';
import { TraderType } from '@prisma/client';

const documentRuleItemSchema = z.object({
  documentKey: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional().nullable(),
  required: z.boolean().optional(),
  acceptedFormats: z.string().trim().max(50).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const entityDocumentRulesSchema = z.object({
  params: z.object({
    traderType: z.enum(['SOLO', 'COMPANY']),
  }),
  body: z.object({
    rules: z.array(documentRuleItemSchema),
  }),
});

export const createEntityDocumentRuleSchema = z.object({
  params: z.object({
    traderType: z.enum(['SOLO', 'COMPANY']),
  }),
  body: documentRuleItemSchema,
});

export const createCategoryDocumentRuleSchema = z.object({
  params: z.object({
    categoryId: z.string().uuid(),
  }),
  body: documentRuleItemSchema,
});

export const documentRuleIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const categoryDocumentRulesSchema = z.object({
  params: z.object({
    categoryId: z.string().uuid(),
  }),
  body: z.object({
    rules: z.array(documentRuleItemSchema),
  }),
});

export const categoryIdParamSchema = z.object({
  params: z.object({
    categoryId: z.string().uuid(),
  }),
});

export type EntityDocumentRulesInput = z.infer<typeof entityDocumentRulesSchema>['body'];
export type CategoryDocumentRulesInput = z.infer<typeof categoryDocumentRulesSchema>['body'];

export const traderTypeFromParam = (value: string): TraderType =>
  value === 'COMPANY' ? TraderType.COMPANY : TraderType.SOLO;
