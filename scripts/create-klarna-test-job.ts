import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('\n❌ DATABASE_URL is not defined in your .env file.');
  console.error('Please add DATABASE_URL=postgresql://... to your .env file,');
  console.error('or run with: $env:DATABASE_URL="postgresql://..."; npx ts-node scripts/create-klarna-test-job.ts\n');
  process.exit(1);
}

import { PrismaClient, PaymentMethod, PaymentStatus, InvoiceStatus, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Looking for customer and category...');
  const customer =
    (await prisma.user.findFirst({ where: { role: UserRole.CUSTOMER } })) ??
    (await prisma.user.findFirst());

  if (!customer) {
    console.error('❌ No user found in database.');
    process.exit(1);
  }

  const category = await prisma.category.findFirst();
  if (!category) {
    console.error('❌ No category found in database.');
    process.exit(1);
  }

  let trader = await prisma.trader.findFirst();
  if (!trader) {
    console.error('❌ No trader found in database.');
    process.exit(1);
  }

  // 1. Check or create Klarna job
  let job = await prisma.job.findFirst({ where: { jobRef: 'JOB-KLARNA-7788' } });
  if (!job) {
    job = await prisma.job.create({
      data: {
        jobRef: 'JOB-KLARNA-7788',
        customerId: customer.id,
        categoryId: category.id,
        title: 'Boiler Maintenance (Klarna Test Job)',
        description: 'Annual boiler safety check and service paid via Klarna.',
        status: 'COMPLETED',
      },
    });
    console.log(`✅ Created job: ${job.jobRef} (${job.id})`);
  } else {
    console.log(`ℹ️ Found existing job: ${job.jobRef} (${job.id})`);
  }

  // 2. Check or create booking
  let booking = await prisma.booking.findFirst({ where: { jobId: job.id } });
  if (!booking) {
    booking = await prisma.booking.create({
      data: {
        bookingRef: 'BKG-KLARNA-7788',
        jobId: job.id,
        traderId: trader.id,
        customerId: customer.id,
        scheduledDate: new Date('2026-08-15'),
        status: 'COMPLETED',
        finishedAt: new Date('2026-08-15T10:00:00Z'),
      },
    });
    console.log(`✅ Created booking: ${booking.bookingRef}`);
  }

  // 3. Check or create invoice
  let invoice = await prisma.invoice.findFirst({ where: { bookingId: booking.id } });
  if (!invoice) {
    invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-KLARNA-7788',
        bookingId: booking.id,
        serviceCharge: 180.0,
        platformFee: 10.0,
        tax: 25.65,
        totalAmount: 215.65,
        status: InvoiceStatus.PAID,
      },
    });
    console.log(`✅ Created invoice: ${invoice.invoiceNumber}`);
  }

  // 4. Check or create Klarna payment
  let payment = await prisma.payment.findFirst({
    where: { invoiceId: invoice.id, method: PaymentMethod.KLARNA, status: PaymentStatus.COMPLETED },
  });
  if (!payment) {
    payment = await prisma.payment.create({
      data: {
        transactionRef: 'TXN-KLARNA-998811',
        stripePaymentIntentId: 'pi_test_klarna_7788',
        invoiceId: invoice.id,
        userId: customer.id,
        amount: 215.65,
        serviceCharge: 180.0,
        feeAmount: 10.0,
        discountAmount: 0.0,
        method: PaymentMethod.KLARNA,
        status: PaymentStatus.COMPLETED,
        paidAt: new Date('2026-08-15T10:30:00Z'),
      },
    });
    console.log(`✅ Created completed Klarna payment: ${payment.transactionRef}`);
  } else {
    console.log(`ℹ️ Found existing Klarna payment: ${payment.transactionRef}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('   🎉 KLARNA TEST JOB READY FOR ADMIN PANEL TESTING');
  console.log('='.repeat(60));
  console.log(`Job ID:       ${job.id}`);
  console.log(`Job Ref:      ${job.jobRef}`);
  console.log(`Title:        ${job.title}`);
  console.log(`Status:       ${job.status}`);
  console.log(`Payment:      KLARNA (Klarna, isKlarna: true)`);
  console.log(`Amount:       €215.65`);
  console.log('='.repeat(60) + '\n');
}

main()
  .catch((e) => {
    console.error('❌ Error creating Klarna job:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

