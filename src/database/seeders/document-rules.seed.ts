import { PrismaClient, DocumentRuleScope, TraderType } from '@prisma/client';
import { logger } from '../../utils/logger';

const soloEntityRules = [
  { documentKey: 'driving_license', name: 'Proof of ID / Driving License', required: true, sortOrder: 0 },
  { documentKey: 'trade_certificate', name: 'Trade Certificate', required: true, sortOrder: 1 },
  { documentKey: 'passport', name: 'Passport (Alternative ID)', required: false, sortOrder: 2 },
  { documentKey: 'bank_statement', name: 'Bank Statement (last 3 Months)', required: false, sortOrder: 3 },
  { documentKey: 'address_proof', name: 'Address Proof', required: false, sortOrder: 4 },
  { documentKey: 'first_aid_certificate', name: 'First Aid Certificate', required: false, sortOrder: 5 },
];

const companyEntityRules = [
  { documentKey: 'director_photo_id', name: 'Director Photo ID', required: true, sortOrder: 0 },
  { documentKey: 'address_proof', name: 'Company Proof of Address', required: true, sortOrder: 1 },
  { documentKey: 'trade_certificates', name: 'Trade Certificates', required: true, sortOrder: 2 },
  { documentKey: 'garda_vetting', name: 'Garda Vetting disclosure (where appropriate)', required: false, sortOrder: 3 },
  { documentKey: 'apprenticeship_completion', name: 'Apprenticeship completion certificates', required: false, sortOrder: 4 },
  { documentKey: 'manufacturer_certifications', name: 'Manufacturer Certifications', required: false, sortOrder: 5 },
  { documentKey: 'safepass_card', name: 'SafePass card', required: false, sortOrder: 6 },
  { documentKey: 'manual_handling', name: 'Manual Handling certificate', required: false, sortOrder: 7 },
  { documentKey: 'working_at_heights', name: 'Working at Heights certificate', required: false, sortOrder: 8 },
  { documentKey: 'proof_of_insurance', name: 'Proof of insurance renewal', required: false, sortOrder: 9 },
  { documentKey: 'vat_certificate', name: 'VAT certificate (if applicable)', required: false, sortOrder: 10 },
  { documentKey: 'tax_clearance', name: 'Tax Clearance Certificate', required: false, sortOrder: 11 },
];

const defaultCategoryDocs = [
  { documentKey: 'trade_qualification', name: 'Trade Qualification / Certificate', required: true, sortOrder: 1 },
  { documentKey: 'insurance', name: 'Insurance (Disabled for now)', required: false, sortOrder: 2 },
  { documentKey: 'work_portfolio', name: 'Work Portfolio / Sample Jobs', required: false, sortOrder: 3 },
];

const categoryRulesBySlug: Record<
  string,
  Array<{ documentKey: string; name: string; required: boolean; sortOrder: number }>
> = {
  'electrical-wiring': [
    { documentKey: 'registered_with', name: 'Registered with relevant body', required: true, sortOrder: 1 },
    { documentKey: 'electrical_qualifications', name: 'Electrical qualifications', required: true, sortOrder: 2 },
    { documentKey: 'insurance', name: 'Insurance', required: false, sortOrder: 3 },
    { documentKey: 'solar_pv_certificate', name: 'Solar PV certificate', required: false, sortOrder: 4 },
    { documentKey: 'ev_charger_installation', name: 'EV charger installation certificate', required: false, sortOrder: 5 },
  ],
  'plumbing-services': [
    { documentKey: 'plumbing_qualifications', name: 'Plumbing qualifications', required: true, sortOrder: 1 },
    { documentKey: 'insurance', name: 'Insurance', required: false, sortOrder: 2 },
    { documentKey: 'rgii_registration', name: 'RGII registration (if working with gas)', required: false, sortOrder: 3 },
  ],
  'carpentry-woodwork': defaultCategoryDocs,
  'painting-decorating': defaultCategoryDocs,
  'hvac-ac-repair': defaultCategoryDocs,
  'roofing-guttering': defaultCategoryDocs,
  'cctv-security-systems': defaultCategoryDocs,
  'cleaning-sanitation': defaultCategoryDocs,
  'locksmith-security-keys': defaultCategoryDocs,
  'interior-design-fitout': defaultCategoryDocs,
  'solar-energy-ev': [
    { documentKey: 'solar_pv_certificate', name: 'Solar PV certificate', required: true, sortOrder: 1 },
    { documentKey: 'insurance', name: 'Insurance', required: false, sortOrder: 2 },
    { documentKey: 'ev_charger_installation', name: 'EV charger installation certificate', required: false, sortOrder: 3 },
  ],
};

export async function seedDocumentRules(prisma: PrismaClient): Promise<void> {
  const upsertEntityRule = async (
    traderType: TraderType,
    rule: { documentKey: string; name: string; required: boolean; sortOrder: number }
  ) => {
    const existing = await prisma.documentRule.findFirst({
      where: {
        scope: DocumentRuleScope.ENTITY,
        traderType,
        categoryId: null,
        documentKey: rule.documentKey,
      },
    });

    if (existing) {
      await prisma.documentRule.update({
        where: { id: existing.id },
        data: {
          name: rule.name,
          required: rule.required,
          sortOrder: rule.sortOrder,
          status: 'active',
        },
      });
      return;
    }

    await prisma.documentRule.create({
      data: {
        scope: DocumentRuleScope.ENTITY,
        traderType,
        documentKey: rule.documentKey,
        name: rule.name,
        required: rule.required,
        sortOrder: rule.sortOrder,
      },
    });
  };

  for (const rule of soloEntityRules) {
    await upsertEntityRule(TraderType.SOLO, rule);
  }
  for (const rule of companyEntityRules) {
    await upsertEntityRule(TraderType.COMPANY, rule);
  }

  const categories = await prisma.category.findMany({
    where: { status: 'active' },
    select: { id: true, urlSlug: true, name: true },
  });

  let categoryRuleCount = 0;
  for (const category of categories) {
    const rules = categoryRulesBySlug[category.urlSlug] ?? defaultCategoryDocs;
    for (const rule of rules) {
      const existing = await prisma.documentRule.findFirst({
        where: {
          scope: DocumentRuleScope.CATEGORY,
          categoryId: category.id,
          documentKey: rule.documentKey,
        },
      });
      if (existing) {
        await prisma.documentRule.update({
          where: { id: existing.id },
          data: {
            name: rule.name,
            required: rule.required,
            sortOrder: rule.sortOrder,
            status: 'active',
          },
        });
      } else {
        await prisma.documentRule.create({
          data: {
            scope: DocumentRuleScope.CATEGORY,
            categoryId: category.id,
            documentKey: rule.documentKey,
            name: rule.name,
            required: rule.required,
            sortOrder: rule.sortOrder,
            status: 'active',
          },
        });
      }
      categoryRuleCount += 1;
    }
  }

  logger.info(
    `Ensured ${soloEntityRules.length + companyEntityRules.length} entity rules and ${categoryRuleCount} category document rules.`
  );
}
