import { DocumentRuleScope, TraderType } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';

export type DocumentRuleInput = {
  documentKey: string;
  name: string;
  description?: string | null;
  required?: boolean;
  acceptedFormats?: string | null;
  sortOrder?: number;
  status?: string;
};

const serializeRule = (rule: {
  id: string;
  scope: DocumentRuleScope;
  traderType: TraderType | null;
  categoryId: string | null;
  documentKey: string;
  name: string;
  description: string | null;
  required: boolean;
  acceptedFormats: string | null;
  sortOrder: number;
  status: string;
}) => ({
  id: rule.id,
  scope: rule.scope,
  traderType: rule.traderType,
  categoryId: rule.categoryId,
  documentKey: rule.documentKey,
  name: rule.name,
  description: rule.description,
  required: rule.required,
  acceptedFormats: rule.acceptedFormats,
  sortOrder: rule.sortOrder,
  status: rule.status,
});

export const listEntityDocumentRules = async (traderType: TraderType) => {
  const rules = await prisma.documentRule.findMany({
    where: {
      scope: DocumentRuleScope.ENTITY,
      traderType,
      status: 'active',
    },
    orderBy: { sortOrder: 'asc' },
  });
  return rules.map(serializeRule);
};

export const listCategoryDocumentRulesByCategoryId = async (categoryId: string) => {
  const rules = await prisma.documentRule.findMany({
    where: {
      scope: DocumentRuleScope.CATEGORY,
      categoryId,
      status: 'active',
    },
    orderBy: { sortOrder: 'asc' },
  });
  return rules.map(serializeRule);
};
export const listCategoryDocumentRules = async (
  categoryIds: string[],
  traderType: TraderType
) => {
  if (!categoryIds.length) {
    return [];
  }

  const rules = await prisma.documentRule.findMany({
    where: {
      scope: DocumentRuleScope.CATEGORY,
      categoryId: { in: categoryIds },
      OR: [{ traderType }, { traderType: null }],
      status: 'active',
    },
    orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
    include: {
      category: { select: { id: true, name: true, categoryCode: true } },
    },
  });

  return rules.map((rule) => ({
    ...serializeRule(rule),
    category: rule.category,
  }));
};

export const replaceEntityDocumentRules = async (
  traderType: TraderType,
  rules: DocumentRuleInput[]
) => {
  await prisma.$transaction(async (tx) => {
    await tx.documentRule.deleteMany({
      where: { scope: DocumentRuleScope.ENTITY, traderType },
    });

    if (rules.length) {
      await tx.documentRule.createMany({
        data: rules.map((rule, index) => ({
          scope: DocumentRuleScope.ENTITY,
          traderType,
          documentKey: rule.documentKey,
          name: rule.name,
          description: rule.description ?? null,
          required: rule.required ?? true,
          acceptedFormats: rule.acceptedFormats ?? 'pdf,image',
          sortOrder: rule.sortOrder ?? index,
          status: rule.status ?? 'active',
        })),
      });
    }
  });

  return listEntityDocumentRules(traderType);
};

export const replaceCategoryDocumentRules = async (
  categoryId: string,
  rules: DocumentRuleInput[]
) => {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    throw new NotFoundError('Category not found.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.documentRule.deleteMany({
      where: { scope: DocumentRuleScope.CATEGORY, categoryId },
    });

    if (rules.length) {
      await tx.documentRule.createMany({
        data: rules.map((rule, index) => ({
          scope: DocumentRuleScope.CATEGORY,
          categoryId,
          traderType: null,
          documentKey: rule.documentKey,
          name: rule.name,
          description: rule.description ?? null,
          required: rule.required ?? true,
          acceptedFormats: rule.acceptedFormats ?? 'pdf,image',
          sortOrder: rule.sortOrder ?? index,
          status: rule.status ?? 'active',
        })),
      });
    }
  });

  const stored = await prisma.documentRule.findMany({
    where: { scope: DocumentRuleScope.CATEGORY, categoryId },
    orderBy: { sortOrder: 'asc' },
  });

  return stored.map(serializeRule);
};

export const getDocumentRequirementsForTrader = async (
  traderType: TraderType,
  categoryIds: string[]
) => {
  const [entityRules, categoryRules] = await Promise.all([
    listEntityDocumentRules(traderType),
    listCategoryDocumentRules(categoryIds, traderType),
  ]);

  return { entityRules, categoryRules };
};

export const assertDocumentRuleExists = async (documentRuleId: string) => {
  const rule = await prisma.documentRule.findUnique({ where: { id: documentRuleId } });
  if (!rule || rule.status !== 'active') {
    throw new NotFoundError('Document requirement not found.');
  }
  return rule;
};

export const validateRequiredDocumentsUploaded = async (
  traderId: string,
  traderType: TraderType,
  categoryIds: string[]
) => {
  const { entityRules, categoryRules } = await getDocumentRequirementsForTrader(
    traderType,
    categoryIds
  );

  const requiredRuleIds = [...entityRules, ...categoryRules]
    .filter((rule) => rule.required)
    .map((rule) => rule.id);

  if (!requiredRuleIds.length) {
    return { complete: true, missing: [] as string[] };
  }

  const uploads = await prisma.traderDocument.findMany({
    where: {
      traderId,
      documentRuleId: { in: requiredRuleIds },
    },
    include: { documentRule: { select: { name: true, documentKey: true } } },
  });

  const uploadedRuleIds = new Set(uploads.map((doc) => doc.documentRuleId));
  const missing = [...entityRules, ...categoryRules]
    .filter((rule) => rule.required && !uploadedRuleIds.has(rule.id))
    .map((rule) => rule.name);

  return { complete: missing.length === 0, missing };
};
