import { PrismaClient, AdminRole, AdminStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logger } from '../../utils/logger';

export async function seedAdmin(prisma: PrismaClient): Promise<void> {
  const admins = [
    {
      fullName: 'System Super Admin',
      email: 'admin@brisk.com',
      mobileNumber: '+353870000000',
      address: 'Dublin, Ireland',
      role: AdminRole.SUPER_ADMIN,
      password: 'Password1!',
    },
    {
      fullName: 'Manmeet',
      email: 'manmeet@brisk.ie',
      mobileNumber: '+353870000001',
      address: 'Dublin, Ireland',
      role: AdminRole.SUPER_ADMIN,
      password: 'Password1!',
    },
  ];

  for (const admin of admins) {
    const existing = await prisma.adminUser.findUnique({
      where: { email: admin.email },
    });

    if (!existing) {
      const passwordHash = await bcrypt.hash(admin.password, 10);
      const created = await prisma.adminUser.create({
        data: {
          fullName: admin.fullName,
          email: admin.email,
          mobileNumber: admin.mobileNumber,
          address: admin.address,
          passwordHash,
          role: admin.role,
          status: AdminStatus.ACTIVE,
        },
      });

      logger.info(`✅ Admin seeded: ${created.email} (${created.role})`);
    } else {
      logger.info(`ℹ️ Admin (${admin.email}) already exists. Skipping.`);
    }
  }
}
