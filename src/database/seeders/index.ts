import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { seedAdmin } from './admin.seed';

const prisma = new PrismaClient();

async function main() {
  logger.info('🌱 Starting database seeding...');
  await seedAdmin(prisma);
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
