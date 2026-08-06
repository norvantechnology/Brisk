import { PrismaClient, AdminRole, AdminStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logger } from '../../utils/logger';

export async function seedAdmin(prisma: PrismaClient): Promise<void> {
  const adminEmail = 'admin@brisk.com';
  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('Password1!', 10);
    const superAdmin = await prisma.adminUser.create({
      data: {
        fullName: 'System Super Admin',
        email: adminEmail,
        mobileNumber: '+353870000000',
        address: 'Dublin, Ireland',
        passwordHash,
        role: AdminRole.SUPER_ADMIN,
        status: AdminStatus.ACTIVE,
      },
    });

    logger.info(`✅ Initial Super Admin seeded: ${superAdmin.email}`);
  } else {
    logger.info(`ℹ️ Super Admin (${adminEmail}) already exists. Skipping.`);
  }
}
