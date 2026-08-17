import { PrismaClient, DocumentRuleScope, TraderType } from '@prisma/client';
import { logger } from '../../utils/logger';

const soloEntityRules = [
  { documentKey: 'passport', name: 'Passport', required: true, sortOrder: 1 },
  { documentKey: 'bank_statement', name: 'Bank Statement (last 3 Months)', required: false, sortOrder: 2 },
  { documentKey: 'address_proof', name: 'Address Proof', required: false, sortOrder: 3 },
  { documentKey: 'first_aid_certificate', name: 'First Aid Certificate', required: false, sortOrder: 4 },
  { documentKey: 'trade_certificate', name: 'Trade Certificate', required: false, sortOrder: 5 },
];

const companyEntityRules = [
  { documentKey: 'garda_vetting', name: 'Garda Vetting disclosure (where appropriate)', required: true, sortOrder: 1 },
  { documentKey: 'trade_certificates', name: 'Trade Certificates', required: false, sortOrder: 2 },
  { documentKey: 'apprenticeship_completion', name: 'Apprenticeship completion certificates', required: false, sortOrder: 3 },
  { documentKey: 'manufacturer_certifications', name: 'Manufacturer Certifications', required: false, sortOrder: 4 },
  { documentKey: 'safepass_card', name: 'SafePass card', required: false, sortOrder: 5 },
  { documentKey: 'manual_handling', name: 'Manual Handling certificate', required: false, sortOrder: 6 },
  { documentKey: 'working_at_heights', name: 'Working at Heights certificate', required: false, sortOrder: 7 },
  { documentKey: 'proof_of_insurance', name: 'Proof of insurance renewal', required: false, sortOrder: 8 },
  { documentKey: 'vat_certificate', name: 'VAT certificate (if applicable)', required: false, sortOrder: 9 },
  { documentKey: 'tax_clearance', name: 'Tax Clearance Certificate', required: false, sortOrder: 10 },
];

const categoryRulesBySlug: Record<string, Array<{ documentKey: string; name: string; required: boolean; sortOrder: number }>> = {
  'electrical-wiring': [
    { documentKey: 'registered_with', name: 'Registered with relevant body', required: true, sortOrder: 1 },
    { documentKey: 'electrical_qualifications', name: 'Electrical qualifications', required: true, sortOrder: 2 },
    { documentKey: 'insurance', name: 'Insurance', required: true, sortOrder: 3 },
    { documentKey: 'solar_pv_certificate', name: 'Solar PV certificate', required: false, sortOrder: 4 },
    { documentKey: 'ev_charger_installation', name: 'EV charger installation certificate', required: false, sortOrder: 5 },
  ],
  'plumbing-services': [
    { documentKey: 'plumbing_qualifications', name: 'Plumbing qualifications', required: true, sortOrder: 1 },
    { documentKey: 'insurance', name: 'Insurance', required: true, sortOrder: 2 },
    { documentKey: 'rgii_registration', name: 'RGII registration (if working with gas)', required: false, sortOrder: 3 },
  ],
};

export async function seedDocumentRules(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.documentRule.count();
  if (existing > 0) {
    logger.info('Document rules already seeded — skipping.');
    return;
  }

  await prisma.documentRule.createMany({
    data: [
      ...soloEntityRules.map((rule) => ({
        scope: DocumentRuleScope.ENTITY,
        traderType: TraderType.SOLO,
        documentKey: rule.documentKey,
        name: rule.name,
        required: rule.required,
        sortOrder: rule.sortOrder,
      })),
      ...companyEntityRules.map((rule) => ({
        scope: DocumentRuleScope.ENTITY,
        traderType: TraderType.COMPANY,
        documentKey: rule.documentKey,
        name: rule.name,
        required: rule.required,
        sortOrder: rule.sortOrder,
      })),
    ],
  });

  const categories = await prisma.category.findMany({
    where: { urlSlug: { in: Object.keys(categoryRulesBySlug) } },
    select: { id: true, urlSlug: true },
  });

  const categoryRuleRows = categories.flatMap((category) =>
    (categoryRulesBySlug[category.urlSlug] ?? []).map((rule) => ({
      scope: DocumentRuleScope.CATEGORY,
      categoryId: category.id,
      traderType: null,
      documentKey: rule.documentKey,
      name: rule.name,
      required: rule.required,
      sortOrder: rule.sortOrder,
    }))
  );

  if (categoryRuleRows.length) {
    await prisma.documentRule.createMany({ data: categoryRuleRows });
  }

  logger.info(`Seeded ${soloEntityRules.length + companyEntityRules.length} entity rules and ${categoryRuleRows.length} category rules.`);
}
