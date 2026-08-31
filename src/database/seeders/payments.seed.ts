import { PrismaClient, PaymentMethod, PaymentStatus, InvoiceStatus, RefundStatus } from '@prisma/client';
import { logger } from '../../utils/logger';

export async function seedPayments(prisma: PrismaClient): Promise<void> {
  const customer = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
  if (!customer) return;

  const category = await prisma.category.findFirst();
  if (!category) return;

  // 1. Seed Sample Job
  const existingJob = await prisma.job.findFirst({ where: { title: 'Radiator Valve Replacement' } });
  let jobId = existingJob?.id;

  if (!existingJob) {
    const createdJob = await prisma.job.create({
      data: {
        jobRef: 'JOB-7725',
        customerId: customer.id,
        categoryId: category.id,
        title: 'Radiator Valve Replacement',
        description: 'Fix radiator leaks and balance temperature.',
        status: 'COMPLETED',
      },
    });
    jobId = createdJob.id;
  }

  // 2. Seed Sample Booking
  let trader = await prisma.trader.findFirst();
  if (!trader) return;

  const existingBooking = await prisma.booking.findFirst({ where: { bookingRef: 'BKG-7725' } });
  let bookingId = existingBooking?.id;

  if (!existingBooking && jobId) {
    const createdBooking = await prisma.booking.create({
      data: {
        bookingRef: 'BKG-7725',
        jobId,
        traderId: trader.id,
        customerId: customer.id,
        scheduledDate: new Date('2026-07-26'),
        status: 'COMPLETED',
      },
    });
    bookingId = createdBooking.id;
  }

  // 3. Seed Sample Invoice
  const existingInvoice = await prisma.invoice.findFirst({ where: { invoiceNumber: 'INV-2026-001' } });
  let invoiceId = existingInvoice?.id;

  if (!existingInvoice && bookingId) {
    const createdInvoice = await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-2026-001',
        bookingId,
        serviceCharge: 95.0,
        platformFee: 5.0,
        totalAmount: 100.0,
        status: InvoiceStatus.PAID,
      },
    });
    invoiceId = createdInvoice.id;
  }

  // 4. Seed Sample Payment Transactions (Matching Screenshot 1 & 2)
  if (invoiceId) {
    const samplePayments = [
      {
        transactionRef: 'TXN-98234109',
        amount: 100.0,
        serviceCharge: 95.0,
        feeAmount: 5.0,
        discountAmount: 0.0,
        method: PaymentMethod.CARD,
        cardBrand: 'Visa',
        cardLast4: '4242',
        status: PaymentStatus.PENDING,
        paidAt: new Date('2026-07-26'),
      },
      {
        transactionRef: 'TXN-98234107',
        amount: 158.0,
        serviceCharge: 150.0,
        feeAmount: 8.0,
        discountAmount: 0.0,
        method: PaymentMethod.GOOGLE_PAY,
        status: PaymentStatus.PENDING,
        paidAt: new Date('2026-07-25'),
      },
      {
        transactionRef: 'TXN-98234106',
        amount: 240.0,
        serviceCharge: 210.0,
        feeAmount: 10.0,
        discountAmount: 20.0,
        method: PaymentMethod.APPLE_PAY,
        status: PaymentStatus.COMPLETED,
        paidAt: new Date('2026-07-24'),
      },
    ];

    for (const p of samplePayments) {
      const existing = await prisma.payment.findUnique({ where: { transactionRef: p.transactionRef } });
      if (!existing) {
        await prisma.payment.create({
          data: {
            transactionRef: p.transactionRef,
            invoiceId,
            userId: customer.id,
            amount: p.amount,
            serviceCharge: p.serviceCharge,
            feeAmount: p.feeAmount,
            discountAmount: p.discountAmount,
            method: p.method,
            cardBrand: p.cardBrand,
            cardLast4: p.cardLast4,
            status: p.status,
            paidAt: p.paidAt,
          },
        });
        logger.info(`✅ Payment transaction seeded: ${p.transactionRef}`);
      }
    }
  }

  // 5. Seed Sample Refunds (Matching Screenshot 4)
  const sampleRefunds = [
    {
      refundRef: 'REF-8812',
      transactionRef: 'TXN-98234108',
      userId: customer.id,
      originalAmount: 365.0,
      refundAmount: 365.0,
      reason: 'Trader cancelled appointment last minute.',
      status: RefundStatus.COMPLETED,
    },
    {
      refundRef: 'REF-8813',
      transactionRef: 'TXN-98234105',
      userId: customer.id,
      originalAmount: 120.0,
      refundAmount: 20.0,
      reason: 'Minor delay in trader arrival at site.',
      status: RefundStatus.APPROVED,
    },
  ];

  for (const ref of sampleRefunds) {
    const existing = await prisma.refund.findUnique({ where: { refundRef: ref.refundRef } });
    if (!existing) {
      await prisma.refund.create({
        data: ref,
      });
      logger.info(`✅ Refund request seeded: ${ref.refundRef} (${ref.status})`);
    }
  }

  // 6. Seed Loyalty Account (Matching Screenshot 5)
  const existingLoyalty = await prisma.loyaltyAccount.findUnique({ where: { userId: customer.id } });
  if (!existingLoyalty) {
    const loyalty = await prisma.loyaltyAccount.create({
      data: {
        userId: customer.id,
        pointsBalance: 1050,
      },
    });

    await prisma.loyaltyTransaction.createMany({
      data: [
        {
          loyaltyAccountId: loyalty.id,
          pointsChange: 1250,
          reason: 'Lifetime points earned for completed job payments',
        },
        {
          loyaltyAccountId: loyalty.id,
          pointsChange: -200,
          reason: 'Redeemed €2.00 discount voucher on checkout',
        },
        {
          loyaltyAccountId: loyalty.id,
          pointsChange: 50,
          reason: 'Completed Booking BKG-7721 - Points earned for completed job payment',
        },
      ],
    });
    logger.info(`✅ Loyalty account seeded for customer: ${customer.fullName}`);
  }
}
