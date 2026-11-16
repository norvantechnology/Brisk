import {
  PrismaClient,
  AdminRole,
  AdminStatus,
  UserStatus,
  VerificationStatus,
  TraderOnboardingStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logger } from '../../utils/logger';

export async function seedAdmin(prisma: PrismaClient): Promise<void> {
  // Migrate legacy admin@brisk.com to admin@brisk.ie if present
  try {
    await prisma.adminUser.updateMany({
      where: { email: 'admin@brisk.com' },
      data: { email: 'admin@brisk.ie' },
    });
  } catch (err) {
    logger.warn('Failed to migrate admin@brisk.com to admin@brisk.ie', err);
  }

  // Ensure brisktrader@gmail.com is fully active and verified
  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: 'brisktrader@gmail.com', mode: 'insensitive' } },
    });
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          status: UserStatus.ACTIVE,
          emailVerified: true,
          mobileVerified: true,
        },
      });

      const trader = await prisma.trader.findUnique({
        where: { userId: user.id },
      });
      if (trader) {
        await prisma.trader.update({
          where: { id: trader.id },
          data: {
            status: 'active',
            verificationStatus: VerificationStatus.VERIFIED,
            onboardingStatus: TraderOnboardingStatus.APPROVED,
            rejectionReason: null,
          },
        });
      } else {
        await prisma.trader.create({
          data: {
            userId: user.id,
            businessName: user.fullName || 'Brisk Trader',
            status: 'active',
            verificationStatus: VerificationStatus.VERIFIED,
            onboardingStatus: TraderOnboardingStatus.APPROVED,
          },
        });
      }

      await prisma.traderRegistration.updateMany({
        where: { userId: user.id },
        data: { status: 'approved' },
      });

      logger.info('✅ brisktrader@gmail.com account verified and activated.');
    }
  } catch (err) {
    logger.warn('Failed to activate brisktrader@gmail.com', { err });
  }

  const admins = [
    {
      fullName: 'System Super Admin',
      email: 'admin@brisk.ie',
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
