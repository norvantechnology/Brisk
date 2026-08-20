import { CmsPublishStatus, PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

const DEFAULT_POLICIES = [
  {
    name: 'Terms & Conditions',
    slug: 'terms-and-conditions',
    versionLabel: '2.1',
    content: `
      <h1>Terms &amp; Conditions</h1>
      <p>Welcome to BRISK. By using the BRISK platform you agree to these Terms &amp; Conditions.</p>
      <h2>1. Accounts</h2>
      <p>You must provide accurate registration information and keep your account secure.</p>
      <h2>2. Services</h2>
      <p>BRISK connects customers with verified traders. Job terms are agreed between the parties.</p>
      <h2>3. Payments</h2>
      <p>Payments are processed securely. Platform fees may apply as shown at checkout.</p>
      <h2>4. Conduct</h2>
      <p>Users must not misuse the platform, post illegal content, or harass others.</p>
      <p>Contact support via Help Center for questions about these terms.</p>
    `.trim(),
  },
  {
    name: 'Privacy Policy & GDPR Compliance',
    slug: 'privacy-policy',
    versionLabel: '1.4',
    content: `
      <h1>Privacy Policy</h1>
      <p>BRISK respects your privacy and processes personal data in line with GDPR.</p>
      <h2>1. Data we collect</h2>
      <p>Account details, contact information, job data, and device/app usage as needed to provide the service.</p>
      <h2>2. How we use data</h2>
      <p>To operate the marketplace, verify traders, process payments, and improve the product.</p>
      <h2>3. Sharing</h2>
      <p>We share data with payment providers and other users only as required to fulfil jobs you request or accept.</p>
      <h2>4. Your rights</h2>
      <p>You may request access, correction, or deletion of your personal data via the app or support.</p>
    `.trim(),
  },
];

export async function seedLegalPolicies(prisma: PrismaClient): Promise<void> {
  for (const policy of DEFAULT_POLICIES) {
    const existing = await prisma.cmsLegalPolicy.findUnique({ where: { slug: policy.slug } });
    if (existing) {
      const published = await prisma.cmsLegalPolicyVersion.findFirst({
        where: { policyId: existing.id, status: CmsPublishStatus.PUBLISHED },
      });
      if (published) continue;

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
