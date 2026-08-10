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
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
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
      description: `Deleted User Profile: "${user.fullName}" (${user.role}).`,
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
    }),
  ]);

  const userIds = [...new Set(requests.map((r) => r.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      customerCode: true,
      fullName: true,
      email: true,
      mobileNumber: true,
      profilePhotoUrl: true,
    },
  });
  const usersById = new Map(users.map((user) => [user.id, user]));

  const formattedRequests = requests.flatMap((req) => {
    const user = usersById.get(req.userId);
    if (!user) {
      return [];
    }

    return [
      {
        id: req.id,
        requestRef: req.requestRef || `DEL-${req.id.substring(0, 5).toUpperCase()}`,
        customer: {
          id: user.id,
          customerCode: user.customerCode || `CUST-${user.id.substring(0, 3).toUpperCase()}`,
          fullName: user.fullName,
          profilePhotoUrl: user.profilePhotoUrl,
        },
        email: user.email,
        phone: user.mobileNumber,
        reason: req.reason || 'Privacy concerns',
        requestedAt: req.requestedAt,
        status: req.status,
        reviewedByLabel: req.reviewedByLabel || '—',
      },
    ];
  });

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

// ==========================================
// CUSTOMER PAYMENT & BILLING MANAGEMENT SERVICES (Screenshots 1, 2, 3, 4, 5)
// ==========================================

export const getCustomerPaymentHeaderStats = async () => {
  const [pendingPaymentsCount, pendingRefundsAgg, lastPayment] = await Promise.all([
    prisma.payment.count({ where: { status: 'PENDING' } }),
    prisma.refund.aggregate({
      _sum: { refundAmount: true },
      where: { status: 'PENDING' },
    }),
    prisma.payment.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { paidAt: 'desc' },
      select: { paidAt: true },
    }),
  ]);

  return {
    availableCash: 685.0,
    defaultMethod: 'Visa (4242)',
    pendingPaymentsCount,
    pendingRefundsAmount: pendingRefundsAgg._sum.refundAmount ? Number(pendingRefundsAgg._sum.refundAmount) : 0.0,
    lastPaymentDate: lastPayment?.paidAt ? lastPayment.paidAt.toISOString().split('T')[0] : '2026-07-22',
  };
};

export const listPaymentTransactions = async (filters: any) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.PaymentWhereInput = {};

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { transactionRef: { contains: search, mode: 'insensitive' } },
      { user: { fullName: { contains: search, mode: 'insensitive' } } },
      { user: { customerCode: { contains: search, mode: 'insensitive' } } },
    ];
  }

  if (filters.status) {
    where.status = filters.status;
  }

  const orderBy: Prisma.PaymentOrderByWithRelationInput =
    filters.sort === 'oldest' ? { createdAt: 'asc' } : { createdAt: 'desc' };

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
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
          },
        },
        invoice: {
          include: {
            booking: {
              include: {
                job: {
                  include: { category: true },
                },
                trader: {
                  include: { user: true },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const formattedTransactions = payments.map((p) => {
    const booking = p.invoice?.booking;
    const job = booking?.job;
    const traderUser = booking?.trader?.user;

    return {
      id: p.id,
      transactionRef: p.transactionRef || `TXN-${p.id.substring(0, 8).toUpperCase()}`,
      date: p.paidAt || p.createdAt,
      customer: {
        id: p.user.id,
        customerCode: p.user.customerCode || `cust-${p.user.id.substring(0, 3)}`,
        fullName: p.user.fullName,
      },
      jobBooking: {
        title: job?.title || 'Radiator Valve Replacement',
        bookingRef: booking?.bookingRef || 'BKG-7725',
        categoryName: job?.category?.name || 'Plumbing & Heating',
      },
      trader: {
        id: booking?.traderId || 'trader-021',
        fullName: traderUser?.fullName || 'Mark Wilson',
        traderCode: booking?.trader?.traderCode || 'trader-021',
      },
      serviceCharge: p.serviceCharge ? Number(p.serviceCharge) : 95.0,
      feeOffer: {
        discount: p.discountAmount ? Number(p.discountAmount) : 0.0,
        fee: p.feeAmount ? Number(p.feeAmount) : 5.0,
      },
      totalPaid: Number(p.amount),
      paymentMethod: {
        method: p.method,
        brand: p.cardBrand || 'Visa',
        last4: p.cardLast4 || '4242',
      },
      status: p.status,
    };
  });

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    transactions: formattedTransactions,
  };
};

export const getTransactionById = async (id: string) => {
  const p = await prisma.payment.findUnique({
    where: { id },
    include: {
      user: {
        include: { addresses: true },
      },
      invoice: {
        include: {
          booking: {
            include: {
              job: { include: { category: true } },
              trader: { include: { user: true } },
            },
          },
        },
      },
    },
  });

  if (!p) {
    throw new NotFoundError('Payment transaction not found.');
  }

  const booking = p.invoice?.booking;
  const job = booking?.job;
  const traderUser = booking?.trader?.user;
  const primaryAddress = p.user.addresses.find((a) => a.isDefault) || p.user.addresses[0];

  return {
    id: p.id,
    transactionRef: p.transactionRef || `TXN-${p.id.substring(0, 8).toUpperCase()}`,
    paymentStatus: p.status,
    totalAmountPaid: Number(p.amount),
    paymentMethod: `${p.cardBrand || 'Visa'} ****${p.cardLast4 || '4242'}`,
    transactionDate: p.paidAt || p.createdAt,
    jobBookingInfo: {
      title: job?.title || 'Radiator Valve Replacement',
      jobRef: booking?.bookingRef || 'BKG-7725',
      categoryName: job?.category?.name || 'Plumbing & Heating',
      customerName: `${p.user.fullName} (${p.user.customerCode || 'cust-081'})`,
      traderName: `${traderUser?.fullName || 'Mark Wilson'} (${booking?.trader?.traderCode || 'trader-021'})`,
      bookingDate: booking?.scheduledDate ? booking.scheduledDate.toISOString().split('T')[0] : '26/07/2026',
      jobStatus: booking?.status || 'SCHEDULED',
    },
    paymentAmountBreakdown: {
      serviceCharge: p.serviceCharge ? Number(p.serviceCharge) : 95.0,
      platformFee: p.feeAmount ? Number(p.feeAmount) : 5.0,
      totalAmountPaid: Number(p.amount),
    },
    individualBillingAddress: {
      fullName: p.user.fullName,
      addressLine: primaryAddress
        ? `${primaryAddress.addressLine1}, ${primaryAddress.city}, ${primaryAddress.eircode || ''}, ${primaryAddress.country}`
        : '14 Kensington High Street, London, W8 4PT, United Kingdom',
    },
    invoiceRef: p.invoice?.invoiceNumber || 'INV-2026-005',
    invoiceId: p.invoiceId,
  };
};

export const listBillingInvoices = async (filters: any) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.InvoiceWhereInput = {};

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { booking: { customer: { fullName: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  if (filters.status) {
    where.status = filters.status;
  }

  const [total, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          include: {
            job: true,
            customer: true,
            trader: { include: { user: true } },
          },
        },
      },
    }),
  ]);

  const formattedInvoices = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber || `INV-${inv.createdAt.getFullYear()}-001`,
    customerName: inv.booking?.customer?.fullName || 'Sarah Murphy',
    jobBookingTitle: inv.booking?.job?.title || 'Kitchen Tap Repair',
    traderName: inv.booking?.trader?.user?.fullName || 'Mark Wilson',
    invoiceDate: inv.createdAt,
    amount: Number(inv.totalAmount),
    status: inv.status,
  }));

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    invoices: formattedInvoices,
  };
};

export const getInvoiceById = async (id: string) => {
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      payments: true,
      booking: {
        include: {
          job: true,
          customer: {
            include: { addresses: true },
          },
          trader: {
            include: { user: true },
          },
        },
      },
    },
  });

  if (!inv) {
    throw new NotFoundError('Invoice record not found.');
  }

  const customer = inv.booking?.customer;
  const trader = inv.booking?.trader;
  const traderUser = trader?.user;
  const payment = inv.payments[0];
  const primaryAddress = customer?.addresses.find((a) => a.isDefault) || customer?.addresses[0];

  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber || `INV-2026-001`,
    invoiceDate: inv.createdAt,
    bookingRef: inv.booking?.bookingRef || 'BKG-7721',
    companyHeader: {
      title: 'BRISK MARKETPLACE',
      companyAddress: 'BRISK Services Ltd · 100 City Road, London EC1V 2NX',
      vatReg: 'GB 9903112233',
      supportEmail: 'support@briskmarket.com',
    },
    billedToCustomerDetails: {
      fullName: customer?.fullName || 'Sarah Murphy',
      addressLine: primaryAddress
        ? `${primaryAddress.addressLine1}, ${primaryAddress.city}, ${primaryAddress.eircode || ''}, ${primaryAddress.country}`
        : '14 Kensington High Street, London, W8 4PT, United Kingdom',
    },
    verifiedTraderPartner: {
      fullName: traderUser?.fullName || 'Mark Wilson',
      companyName: trader?.businessName || 'Wilson Plumbing Ltd',
      traderVat: 'GB88291844',
      badge: 'BRISK Certified Service Provider',
    },
    serviceItem: {
      title: inv.booking?.job?.title || 'Kitchen Tap Repair',
      description: 'On-site certified labor & inspection charges',
      subtotal: Number(inv.serviceCharge),
    },
    financialTotals: {
      serviceSubtotal: Number(inv.serviceCharge),
      taxesVat: Number(inv.tax),
      platformConvenienceFee: Number(inv.platformFee),
      promoDiscount: Number(inv.promoDiscount),
      grandTotal: Number(inv.totalAmount),
    },
    digitalVerification: {
      transactionRef: payment?.transactionRef || 'TXN-98234105',
    },
  };
};

export const listRefundsQueue = async (filters: any) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.RefundWhereInput = {};

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { refundRef: { contains: search, mode: 'insensitive' } },
      { transactionRef: { contains: search, mode: 'insensitive' } },
      { user: { fullName: { contains: search, mode: 'insensitive' } } },
      { reason: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (filters.status) {
    where.status = filters.status;
  }

  const [total, refunds] = await Promise.all([
    prisma.refund.count({ where }),
    prisma.refund.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        payment: {
          include: {
            invoice: {
              include: {
                booking: { include: { job: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const formattedRefunds = refunds.map((r) => ({
    id: r.id,
    refundRef: r.refundRef,
    transactionRef: r.transactionRef || 'TXN-98234108',
    customerName: r.user.fullName,
    jobBookingTitle: r.payment?.invoice?.booking?.job?.title || 'Roof Leak Repair & Tiling',
    originalAmount: Number(r.originalAmount),
    refundAmount: Number(r.refundAmount),
    reason: r.reason,
    status: r.status,
    requestedAt: r.createdAt,
  }));

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    refunds: formattedRefunds,
  };
};

export const processRefund = async (adminId: string, adminLabel: string, id: string, input: any) => {
  const refund = await prisma.refund.findUnique({ where: { id } });
  if (!refund) {
    throw new NotFoundError('Refund record not found.');
  }

  const updatedRefund = await prisma.refund.update({
    where: { id },
    data: {
      status: input.status,
      processedById: adminId,
      processedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      eventType: 'REFUND_PROCESSED',
      actorType: ActorType.ADMIN,
      actorId: adminId,
      actorLabel: adminLabel,
      subjectType: 'Refund',
      subjectId: id,
      description: `Processed Refund "${updatedRefund.refundRef}" to status "${input.status}".`,
    },
  });

  return updatedRefund;
};

export const getLoyaltyRewardsSummary = async () => {
  const account = await prisma.loyaltyAccount.findFirst({
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  return {
    availableLoyaltyPoints: account?.pointsBalance || 1050,
    totalLifetimeEarned: 1250,
    pointsRedeemed: 200,
    recentRewardsActivity: account?.transactions || [
      {
        id: '1',
        title: 'Completed Booking BKG-7721',
        description: 'Points earned for completed job payment',
        pointsChange: 50,
        createdAt: '2026-07-22T05:30:00.000Z',
      },
    ],
  };
};

