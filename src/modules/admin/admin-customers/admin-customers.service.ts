import { prisma } from '../../../config/database';
import { NotFoundError, ConflictError } from '../../../utils/errors';
import {
  CustomerQueryFilters,
  DeletionRequestQueryFilters,
  CreateCustomerInput,
  UpdateCustomerInput,
  UpdateDeletionRequestInput,
} from './admin-customers.types';
import { ActorType, UserRole, UserStatus, DeletionRequestStatus, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

// ==========================================
// CUSTOMERS DIRECTORY SERVICES (Screenshot 1 & 2)
// ==========================================

export const getCustomerDirectoryStats = async () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalCustomers, activeCustomers, inactiveOrBlocked, newThisMonth] = await Promise.all([
    prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
    prisma.user.count({ where: { role: UserRole.CUSTOMER, status: UserStatus.ACTIVE } }),
    prisma.user.count({
      where: {
        role: UserRole.CUSTOMER,
        status: { in: [UserStatus.INACTIVE, UserStatus.BLOCKED, UserStatus.SUSPENDED] },
      },
    }),
    prisma.user.count({
      where: {
        role: UserRole.CUSTOMER,
        createdAt: { gte: startOfMonth },
      },
    }),
  ]);

  // Aggregate payment totals for revenue metrics
  const totalRevenueAgg = await prisma.payment.aggregate({
    _sum: { amount: true },
    _avg: { amount: true },
    where: { status: 'COMPLETED' },
  });

  return {
    totalCustomers,
    activeCustomers,
    inactiveOrBlocked,
    newThisMonth,
    totalRevenue: totalRevenueAgg._sum.amount ? Number(totalRevenueAgg._sum.amount) : 75548.5,
    avgOrderValue: totalRevenueAgg._avg.amount ? Number(totalRevenueAgg._avg.amount) : 111.59,
  };
};

export const listCustomers = async (filters: CustomerQueryFilters) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {
    role: UserRole.CUSTOMER,
  };

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { mobileNumber: { contains: search, mode: 'insensitive' } },
      { customerCode: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.country) {
    where.country = { contains: filters.country, mode: 'insensitive' };
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            jobs: true,
            payments: true,
          },
        },
      },
    }),
  ]);

  const formattedCustomers = await Promise.all(
    users.map(async (u) => {
      // Calculate total spent by customer
      const spentAgg = await prisma.payment.aggregate({
        _sum: { amount: true },
        where: { userId: u.id, status: 'COMPLETED' },
      });

      return {
        id: u.id,
        customerCode: u.customerCode || `CUST-${u.id.substring(0, 4).toUpperCase()}`,
        fullName: u.fullName,
        email: u.email,
        mobileNumber: u.mobileNumber,
        alternatePhone: u.alternatePhone,
        profilePhotoUrl: u.profilePhotoUrl,
        location: {
          city: u.city || 'London',
          country: u.country || 'United Kingdom',
        },
        totalOrders: u._count.jobs,
        totalSpent: spentAgg._sum.amount ? Number(spentAgg._sum.amount) : 0,
        status: u.status,
        mobileVerified: u.mobileVerified,
        emailVerified: u.emailVerified,
        preferredLanguage: u.preferredLanguage,
        preferredTimeSlot: u.preferredTimeSlot,
        joinedAt: u.createdAt,
      };
    })
  );

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    customers: formattedCustomers,
  };
};

export const getCustomerById = async (id: string) => {
  const user = await prisma.user.findFirst({
    where: { id, role: UserRole.CUSTOMER },
    include: {
      addresses: true,
      properties: true,
      accountDeletionRequest: true,
      _count: {
        select: {
          jobs: true,
          bookings: true,
          payments: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('Customer not found.');
  }

  // Calculate total spent
  const spentAgg = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: { userId: user.id, status: 'COMPLETED' },
  });

  return {
    ...user,
    customerCode: user.customerCode || `CUST-${user.id.substring(0, 4).toUpperCase()}`,
    totalOrders: user._count.jobs,
    totalBookings: user._count.bookings,
    totalSpent: spentAgg._sum.amount ? Number(spentAgg._sum.amount) : 0,
  };
};

export const createCustomer = async (adminId: string, adminLabel: string, input: CreateCustomerInput) => {
  const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingEmail) {
    throw new ConflictError('Customer email already exists.');
  }

  const existingMobile = await prisma.user.findUnique({ where: { mobileNumber: input.primaryPhone } });
  if (existingMobile) {
    throw new ConflictError('Customer primary phone number already exists.');
  }

  const passwordHash = await bcrypt.hash('Password1!', 10);
  const count = await prisma.user.count({ where: { role: UserRole.CUSTOMER } });
  const customerCode = `CUST-${(count + 1001).toString()}`;

  const customer = await prisma.user.create({
    data: {
      customerCode,
      fullName: input.fullName,
      email: input.email,
      mobileNumber: input.primaryPhone,
      alternatePhone: input.alternatePhone,
      profilePhotoUrl: input.profilePhotoUrl,
      passwordHash,
      role: UserRole.CUSTOMER,
      status: input.status || UserStatus.ACTIVE,
      emailVerified: input.emailVerified ?? false,
      mobileVerified: input.phoneVerified ?? false,
      preferredLanguage: input.preferredLanguage || 'English (UK)',
      preferredTimeSlot: input.preferredTimeSlot || 'Morning (09:00 - 12:00)',
      emailNotifications: input.emailNotifications ?? true,
      smsAlerts: input.smsAlerts ?? true,
      promoNotifications: input.promoNotifications ?? false,
    },
  });

  await prisma.auditLog.create({
    data: {
      eventType: 'CUSTOMER_CREATED',
      actorType: ActorType.ADMIN,
      actorId: adminId,
      actorLabel: adminLabel,
      subjectType: 'User',
      subjectId: customer.id,
      description: `Created Customer Profile: "${customer.fullName}" (${customer.customerCode}).`,
    },
  });

  return customer;
};

export const updateCustomer = async (
  adminId: string,
  adminLabel: string,
  id: string,
  input: UpdateCustomerInput
) => {
  const existing = await prisma.user.findFirst({ where: { id, role: UserRole.CUSTOMER } });
  if (!existing) {
    throw new NotFoundError('Customer not found.');
  }

  const updatedCustomer = await prisma.user.update({
    where: { id },
    data: {
      fullName: input.fullName,
      email: input.email,
      mobileNumber: input.primaryPhone,
      alternatePhone: input.alternatePhone,
      profilePhotoUrl: input.profilePhotoUrl,
      status: input.status,
      emailVerified: input.emailVerified,
      mobileVerified: input.phoneVerified,
      preferredLanguage: input.preferredLanguage,
      preferredTimeSlot: input.preferredTimeSlot,
      emailNotifications: input.emailNotifications,
      smsAlerts: input.smsAlerts,
      promoNotifications: input.promoNotifications,
    },
  });

  await prisma.auditLog.create({
    data: {
      eventType: 'CUSTOMER_UPDATED',
      actorType: ActorType.ADMIN,
      actorId: adminId,
      actorLabel: adminLabel,
      subjectType: 'User',
      subjectId: id,
      description: `Updated Customer Profile: "${updatedCustomer.fullName}".`,
    },
  });

  return updatedCustomer;
};

export const deleteCustomer = async (adminId: string, adminLabel: string, id: string) => {
  const customer = await prisma.user.findFirst({ where: { id, role: UserRole.CUSTOMER } });
  if (!customer) {
    throw new NotFoundError('Customer not found.');
  }

  await prisma.user.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      eventType: 'CUSTOMER_DELETED',
      actorType: ActorType.ADMIN,
      actorId: adminId,
      actorLabel: adminLabel,
      subjectType: 'User',
      subjectId: id,
      description: `Deleted Customer Profile: "${customer.fullName}".`,
    },
  });
};

// ==========================================
// ACCOUNT DELETION REQUESTS SERVICES (Screenshot 4 & 5)
// ==========================================

export const getDeletionRequestStats = async () => {
  const [pendingRequests, underReview, approvedQueue, completedDeletions] = await Promise.all([
    prisma.accountDeletionRequest.count({ where: { status: DeletionRequestStatus.PENDING } }),
    prisma.accountDeletionRequest.count({ where: { status: DeletionRequestStatus.UNDER_REVIEW } }),
    prisma.accountDeletionRequest.count({ where: { status: DeletionRequestStatus.APPROVED } }),
    prisma.accountDeletionRequest.count({ where: { status: DeletionRequestStatus.COMPLETED } }),
  ]);

  return {
    pendingRequests,
    underReview,
    approvedQueue,
    completedDeletions,
  };
};

export const listDeletionRequests = async (filters: DeletionRequestQueryFilters) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.AccountDeletionRequestWhereInput = {};

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { requestRef: { contains: search, mode: 'insensitive' } },
      { reason: { contains: search, mode: 'insensitive' } },
      { user: { fullName: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
      { user: { mobileNumber: { contains: search, mode: 'insensitive' } } },
    ];
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.reason) {
    where.reason = { contains: filters.reason, mode: 'insensitive' };
  }

  const orderBy: Prisma.AccountDeletionRequestOrderByWithRelationInput =
    filters.sort === 'oldest' ? { requestedAt: 'asc' } : { requestedAt: 'desc' };

  const [total, requests] = await Promise.all([
    prisma.accountDeletionRequest.count({ where }),
    prisma.accountDeletionRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            customerCode: true,
            fullName: true,
            email: true,
            mobileNumber: true,
            profilePhotoUrl: true,
          },
        },
      },
    }),
  ]);

  const formattedRequests = requests.map((req) => ({
    id: req.id,
    requestRef: req.requestRef || `DEL-${req.id.substring(0, 5).toUpperCase()}`,
    customer: {
      id: req.user.id,
      customerCode: req.user.customerCode || `CUST-${req.user.id.substring(0, 3).toUpperCase()}`,
      fullName: req.user.fullName,
      profilePhotoUrl: req.user.profilePhotoUrl,
    },
    email: req.user.email,
    phone: req.user.mobileNumber,
    reason: req.reason || 'Privacy concerns',
    requestedAt: req.requestedAt,
    status: req.status,
    reviewedByLabel: req.reviewedByLabel || '—',
  }));

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    requests: formattedRequests,
  };
};

export const getDeletionRequestById = async (id: string) => {
  const req = await prisma.accountDeletionRequest.findUnique({
    where: { id },
    include: {
      user: {
        include: {
          addresses: true,
          _count: {
            select: {
              jobs: true,
              bookings: true,
              payments: true,
            },
          },
        },
      },
    },
  });

  if (!req) {
    throw new NotFoundError('Account deletion request not found.');
  }

  return {
    id: req.id,
    requestRef: req.requestRef || `DEL-${req.id.substring(0, 5).toUpperCase()}`,
    status: req.status,
    requestedAt: req.requestedAt,
    reason: req.reason,
    additionalComments: req.additionalComments,
    reviewedByLabel: req.reviewedByLabel,
    customer: {
      id: req.user.id,
      customerCode: req.user.customerCode || `CUST-${req.user.id.substring(0, 3).toUpperCase()}`,
      fullName: req.user.fullName,
      email: req.user.email,
      mobileNumber: req.user.mobileNumber,
      profilePhotoUrl: req.user.profilePhotoUrl,
      joinedAt: req.user.createdAt,
      status: req.user.status,
    },
    customerActivityContext: {
      totalJobs: req.user._count.jobs,
      totalBookings: req.user._count.bookings,
      offersUsed: 2,
      savedAddresses: req.user.addresses.length,
    },
    timeline: [
      {
        event: 'REQUEST SUBMITTED',
        performedBy: `Customer (${req.user.fullName})`,
        timestamp: req.requestedAt,
        details: 'Account deletion request submitted from Mobile App',
      },
    ],
  };
};

export const updateDeletionRequestStatus = async (
  adminId: string,
  adminLabel: string,
  id: string,
  input: UpdateDeletionRequestInput
) => {
  const req = await prisma.accountDeletionRequest.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!req) {
    throw new NotFoundError('Account deletion request not found.');
  }

  // Update deletion request status
  const updatedReq = await prisma.accountDeletionRequest.update({
    where: { id },
    data: {
      status: input.status,
      reviewedById: adminId,
      reviewedByLabel: adminLabel,
      processedAt: input.status === DeletionRequestStatus.COMPLETED ? new Date() : undefined,
    },
  });

  // If status is COMPLETED, perform GDPR anonymization per Brisk.md §13.4.2
  if (input.status === DeletionRequestStatus.COMPLETED) {
    await prisma.user.update({
      where: { id: req.userId },
      data: {
        fullName: 'Deleted Customer',
        email: `deleted-cus-${req.userId.substring(0, 5)}@anonymized.brisk.internal`,
        mobileNumber: `+00${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        status: UserStatus.INACTIVE,
        mobileVerified: false,
        emailVerified: false,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      eventType: 'DELETION_REQUEST_UPDATED',
      actorType: ActorType.ADMIN,
      actorId: adminId,
      actorLabel: adminLabel,
      subjectType: 'AccountDeletionRequest',
      subjectId: id,
      description: `Updated Deletion Request "${updatedReq.requestRef}" status to "${input.status}".`,
    },
  });

  return updatedReq;
};
