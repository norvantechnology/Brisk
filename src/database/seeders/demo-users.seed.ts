import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logger } from '../../utils/logger';

export async function seedDemoUsers(prisma: PrismaClient): Promise<void> {
  const passwordHash = await bcrypt.hash('Password1!', 10);

  // 1. Seed Demo Customer User
  const customerEmail = 'customer@brisk.com';
  const existingCustomer = await prisma.user.findUnique({ where: { email: customerEmail } });
  if (!existingCustomer) {
    await prisma.user.create({
      data: {
        fullName: 'Jane Customer',
        email: customerEmail,
        mobileNumber: '+353871234567',
        passwordHash,
        role: UserRole.CUSTOMER,
        mobileVerified: true,
      },
    });
    logger.info(`✅ Demo Customer seeded: ${customerEmail}`);
  }

  // 2. Seed Demo Trader User
  const traderEmail = 'trader@brisk.com';
  const existingTrader = await prisma.user.findUnique({ where: { email: traderEmail } });
  if (!existingTrader) {
    const traderUser = await prisma.user.create({
      data: {
        fullName: 'John Trader',
        email: traderEmail,
        mobileNumber: '+353879876543',
        passwordHash,
        role: UserRole.TRADER,
        mobileVerified: true,
      },
    });

    await prisma.trader.create({
      data: {
        userId: traderUser.id,
        businessName: 'John Plumbing & Electrical Ltd',
        bio: 'Professional plumbing services with over 10 years experience.',
        yearsExperience: 10,
        traderCode: 'TRD-1001',
        verificationStatus: 'VERIFIED',
      },
    });
    logger.info(`✅ Demo Trader seeded: ${traderEmail}`);
  }
}
