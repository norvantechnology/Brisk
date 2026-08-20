import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { seedAdmin } from './admin.seed';
import { seedDemoUsers } from './demo-users.seed';
import { seedCategories } from './categories.seed';
import { seedCustomers } from './customers.seed';
import { seedPayments } from './payments.seed';
import { seedMarketingPages } from './marketing-pages.seed';
import { seedDocumentRules } from './document-rules.seed';
import { seedLegalPolicies } from './legal.seed';

const prisma = new PrismaClient();

async function main() {
  logger.info('🌱 Starting database seeding...');
  await seedAdmin(prisma);
  await seedDemoUsers(prisma);
  await seedCategories(prisma);
  await seedCustomers(prisma);
  await seedPayments(prisma);
  await seedMarketingPages(prisma);
  await seedDocumentRules(prisma);
  await seedLegalPolicies(prisma);
  logger.info('✅ Database seeding completed successfully.');
}

main()
  .catch((e) => {
    logger.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
