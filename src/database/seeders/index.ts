import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { seedAdmin } from './admin.seed';
import { seedDemoUsers } from './demo-users.seed';
import { seedCategories } from './categories.seed';
import { seedCustomers } from './customers.seed';

const prisma = new PrismaClient();

async function main() {
  logger.info('🌱 Starting database seeding...');
  await seedAdmin(prisma);
  await seedDemoUsers(prisma);
  await seedCategories(prisma);
  await seedCustomers(prisma);
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
