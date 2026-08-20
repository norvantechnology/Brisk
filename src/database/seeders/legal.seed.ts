import { CmsPublishStatus, PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

const DEFAULT_POLICIES = [
  {
    name: 'Terms & Conditions',
    slug: 'terms-and-conditions',
    versionLabel: '2.1',
    content: `
      <h1>Terms &amp; Conditions</h1>
      <p class="subtitle">Last updated for BRISK platform users (customers and traders).</p>
      <p>Welcome to BRISK. By creating an account or using the BRISK apps and website, you agree to these Terms &amp; Conditions.</p>
      <h2>1. Accounts</h2>
      <p>You must provide accurate registration information and keep your login details secure. You are responsible for activity under your account.</p>
      <h2>2. Services</h2>
      <p>BRISK connects customers with traders. Job scope, pricing, and timelines are agreed between the parties. BRISK is a marketplace platform, not the service provider for trade work.</p>
      <h2>3. Payments</h2>
      <p>Payments are processed through approved payment partners. Platform fees, if any, are shown before you confirm a payment.</p>
      <h2>4. Offers &amp; promotions</h2>
      <p>Offers may have limited validity, eligibility rules, and usage limits. BRISK may update or withdraw offers at any time.</p>
      <h2>5. Conduct</h2>
      <p>Do not misuse the platform, post illegal content, spam, or harass other users. We may suspend accounts that breach these rules.</p>
      <h2>6. Contact</h2>
      <p>Questions about these terms? Open Help Center in the app or contact BRISK support.</p>
    `.trim(),
  },
  {
    name: 'Privacy Policy & GDPR Compliance',
    slug: 'privacy-policy',
    versionLabel: '1.4',
    content: `
      <h1>Privacy Policy</h1>
      <p class="subtitle">How BRISK collects, uses, and protects your personal data (GDPR).</p>
      <p>BRISK respects your privacy. This policy explains what we collect and why.</p>
      <h2>1. Data we collect</h2>
      <p>Account details (name, email, mobile), profile and onboarding documents, job and offer activity, and basic device/app usage needed to run the service.</p>
      <h2>2. How we use data</h2>
      <p>To operate the marketplace, verify traders, process payments, send service notifications, and improve product quality and safety.</p>
      <h2>3. Sharing</h2>
      <p>We share data with payment providers and with other users only as required to complete jobs you request or accept. We do not sell your personal data.</p>
      <h2>4. Retention &amp; security</h2>
      <p>We keep data only as long as needed for the purposes above or as required by law. Access is limited and protected with industry-standard controls.</p>
      <h2>5. Your rights</h2>
      <p>You may request access, correction, or deletion of your personal data via the app (account deletion) or by contacting support.</p>
    `.trim(),
  },
];

export async function seedLegalPolicies(prisma: PrismaClient): Promise<void> {
  for (const policy of DEFAULT_POLICIES) {
    const existing = await prisma.cmsLegalPolicy.findUnique({ where: { slug: policy.slug } });
    if (existing) {
      const published = await prisma.cmsLegalPolicyVersion.findFirst({
        where: { policyId: existing.id, status: CmsPublishStatus.PUBLISHED },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      });
      if (published) {
        await prisma.cmsLegalPolicyVersion.update({
          where: { id: published.id },
          data: {
            content: policy.content,
            versionLabel: policy.versionLabel,
          },
        });
        continue;
      }

      await prisma.cmsLegalPolicyVersion.create({
        data: {
          policyId: existing.id,
          versionLabel: policy.versionLabel,
          content: policy.content,
          effectiveDate: new Date(),
          status: CmsPublishStatus.PUBLISHED,
          publishedAt: new Date(),
        },
      });
      continue;
    }

    await prisma.cmsLegalPolicy.create({
      data: {
        name: policy.name,
        slug: policy.slug,
        versions: {
          create: {
            versionLabel: policy.versionLabel,
            content: policy.content,
            effectiveDate: new Date(),
            status: CmsPublishStatus.PUBLISHED,
            publishedAt: new Date(),
          },
        },
      },
    });
  }

  logger.info('✅ Legal policies seeded (terms-and-conditions, privacy-policy).');
}

/** Ensure published policies exist (safe to call from HTML webview handlers on live). */
export async function ensureLegalPoliciesPublished(prisma: PrismaClient): Promise<void> {
  await seedLegalPolicies(prisma);
}
