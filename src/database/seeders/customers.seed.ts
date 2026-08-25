import { PrismaClient, UserRole, UserStatus, DeletionRequestStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logger } from '../../utils/logger';

export async function seedCustomers(prisma: PrismaClient): Promise<void> {
  const passwordHash = await bcrypt.hash('Password1!', 10);

  const sampleCustomers = [
    {
      customerCode: 'CUST-001',
      fullName: 'Sarah Murphy',
      email: 'sarah.murphy@example.com',
      mobileNumber: '+447700900881',
      status: UserStatus.ACTIVE,
      mobileVerified: true,
      emailVerified: true,
      city: 'London',
      country: 'United Kingdom',
      deletionRequest: {
        requestRef: 'DEL-00021',
        reason: 'Privacy concerns',
        additionalComments: 'I no longer want to use the platform and would like my account information removed safely.',
        status: DeletionRequestStatus.PENDING,
      },
    },
    {
      customerCode: 'CUST-002',
      fullName: 'David Miller',
      email: 'david.miller@example.com',
      mobileNumber: '+447700900882',
      status: UserStatus.ACTIVE,
      mobileVerified: true,
      emailVerified: true,
      city: 'Vancouver',
      country: 'Canada',
      deletionRequest: {
        requestRef: 'DEL-00022',
        reason: 'I no longer need the service',
        status: DeletionRequestStatus.UNDER_REVIEW,
        reviewedByLabel: 'Super Admin (Snehal Vyas)',
      },
    },
    {
      customerCode: 'CUST-003',
      fullName: 'Emma Watson',
      email: 'emma.watson@example.com',
      mobileNumber: '+447700900883',
      status: UserStatus.ACTIVE,
      mobileVerified: true,
      emailVerified: true,
      city: 'London',
      country: 'United Kingdom',
      deletionRequest: {
        requestRef: 'DEL-00023',
        reason: 'Poor service experience',
        status: DeletionRequestStatus.APPROVED,
        reviewedByLabel: 'Compliance Lead',
      },
    },
    {
      customerCode: 'CUST-004',
      fullName: 'Robert Langdon',
      email: 'robert.langdon@example.com',
      mobileNumber: '+447700900884',
      status: UserStatus.SUSPENDED,
      mobileVerified: true,
      emailVerified: false,
      city: 'London',
      country: 'United Kingdom',
      deletionRequest: {
        requestRef: 'DEL-00019',
        reason: 'Privacy concerns',
        status: DeletionRequestStatus.REJECTED,
        reviewedByLabel: 'Operations Admin',
      },
    },
    {
      customerCode: 'CUST-005',
      fullName: 'Deleted Customer',
      email: 'deleted-cus-005@anonymized.brisk.internal',
      mobileNumber: '+000000000099',
      status: UserStatus.INACTIVE,
      mobileVerified: false,
      emailVerified: false,
      city: 'London',
      country: 'United Kingdom',
      deletionRequest: {
        requestRef: 'DEL-00015',
        reason: 'Other reasons',
        status: DeletionRequestStatus.COMPLETED,
        reviewedByLabel: 'Super Admin',
      },
    },
    {
      customerCode: 'CUST-1078',
      fullName: 'Betty Wright',
      email: 'betty.wright78@example.com',
      mobileNumber: '+447700900078',
      status: UserStatus.INACTIVE,
      mobileVerified: true,
      emailVerified: true,
      city: 'London',
      country: 'United Kingdom',
    },
    {
      customerCode: 'CUST-1045',
      fullName: 'Brian Scott',
      email: 'brian.scott45@example.com',
      mobileNumber: '+447700900045',
      status: UserStatus.PENDING,
      mobileVerified: false,
      emailVerified: false,
      city: 'Vancouver',
      country: 'Canada',
    },
    {
      customerCode: 'CUST-1069',
      fullName: 'Charles Davis',
      email: 'charles.davis69@example.com',
      mobileNumber: '+447700900069',
      status: UserStatus.ACTIVE,
      mobileVerified: true,
      emailVerified: true,
      city: 'Vancouver',
      country: 'Canada',
    },
  ];

  for (const cust of sampleCustomers) {
    const existing = await prisma.user.findUnique({
      where: { email: cust.email },
    });

    let userId = existing?.id;

    if (!existing) {
      const codeTaken = await prisma.user.findUnique({
        where: { customerCode: cust.customerCode },
      });
      if (codeTaken) {
        userId = codeTaken.id;
        logger.info(`ℹ️ Customer code ${cust.customerCode} already exists. Skipping create.`);
      } else {
        const created = await prisma.user.create({
          data: {
            customerCode: cust.customerCode,
            fullName: cust.fullName,
            email: cust.email,
            mobileNumber: cust.mobileNumber,
            passwordHash,
            role: UserRole.CUSTOMER,
            status: cust.status,
            mobileVerified: cust.mobileVerified,
            emailVerified: cust.emailVerified,
            city: cust.city,
            country: cust.country,
          },
        });
        userId = created.id;
        logger.info(`✅ Customer seeded: ${cust.fullName} (${cust.customerCode})`);
      }
    }

    if (userId && cust.deletionRequest) {
      const existingDel = await prisma.accountDeletionRequest.findUnique({
        where: { userId },
      });

      if (!existingDel) {
        await prisma.accountDeletionRequest.create({
          data: {
            requestRef: cust.deletionRequest.requestRef,
            userId,
            reason: cust.deletionRequest.reason,
            additionalComments: cust.deletionRequest.additionalComments,
            status: cust.deletionRequest.status,
            reviewedByLabel: cust.deletionRequest.reviewedByLabel,
          },
        });
        logger.info(`  ↳ Deletion request seeded: ${cust.deletionRequest.requestRef} (${cust.deletionRequest.status})`);
      }
    }
  }
}
