/**
 * Delete API test users that cannot be removed via admin customer DELETE (TRADER role).
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." DIRECT_URL="postgresql://..." \
 *     npx ts-node scripts/cleanup-trader-test-users.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const patterns = ['apitest.', '@test.brisk.internal', 'briskcustomer@gmail.com'];

  const users = await prisma.user.findMany({
    where: {
      OR: patterns.map((pattern) => ({
        OR: [
          { email: { contains: pattern, mode: 'insensitive' } },
          { fullName: { contains: 'API Test', mode: 'insensitive' } },
        ],
      })),
    },
    select: { id: true, email: true, role: true, fullName: true },
  });

  if (users.length === 0) {
    console.log('No test users found to delete.');
    return;
  }

  for (const user of users) {
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`Deleted ${user.role} user: ${user.email} (${user.id})`);
  }

  console.log(`Cleanup complete. Removed ${users.length} test user(s).`);
}

main()
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
