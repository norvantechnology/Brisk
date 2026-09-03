import {
  DiscountType,
  InvoiceStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { prisma } from '../../config/database';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { computeInvoiceBreakdown } from '../jobs/jobs.service';
import type {
  ApplyPromoInput,
  ConfirmPaymentInput,
  CreatePaymentIntentInput,
} from './checkout.validation';

const money = (value: Prisma.Decimal | number | null | undefined): number =>
  value == null ? 0 : Number(value);

const round2 = (n: number) => Math.round(n * 100) / 100;

const generateTransactionRef = () => `TXN-${randomBytes(4).toString('hex').toUpperCase()}`;

const computePromoDiscount = (
  baseAmount: number,
  discountType: DiscountType,
  discountValue: number
): number => {
  let discount = 0;
  switch (discountType) {
    case DiscountType.FLAT:
      discount = discountValue;
      break;
    case DiscountType.PERCENTAGE:
      discount = (baseAmount * discountValue) / 100;
      break;
    case DiscountType.FREE_SERVICE:
      discount = baseAmount;
      break;
    default:
      discount = 0;
  }
  return round2(Math.min(Math.max(discount, 0), baseAmount));
};

const invoiceOwnershipInclude = {
  booking: {
    include: {
      job: {
        include: {
          category: { select: { id: true, name: true } },
          subcategory: { select: { id: true, name: true } },
          offer: {
            select: {
              id: true,
              title: true,
              discountType: true,
              discountValue: true,
              discountLabel: true,
              currencyCode: true,
            },
          },
          photos: { take: 1, orderBy: { createdAt: 'asc' as const } },
        },
      },
      trader: {
        select: {
          id: true,
          businessName: true,
          user: { select: { fullName: true } },
        },
      },
      customer: {
        select: { id: true, fullName: true, email: true },
      },
    },
  },
  payments: { orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.InvoiceInclude;

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{ include: typeof invoiceOwnershipInclude }>;

const assertInvoiceOwner = (invoice: InvoiceWithRelations, userId: string) => {
  if (invoice.booking.customerId !== userId) {
    throw new ForbiddenError('You do not have access to this invoice.');
  }
};

const serializeInvoiceBreakdown = (invoice: {
  serviceCharge: Prisma.Decimal;
  traderOfferDiscount: Prisma.Decimal;
  promoDiscount: Prisma.Decimal;
  platformFee: Prisma.Decimal;
  tax: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  currencyCode: string;
}) => ({
  serviceCharge: money(invoice.serviceCharge),
  traderOfferDiscount: money(invoice.traderOfferDiscount),
  promoDiscount: money(invoice.promoDiscount),
  platformFee: money(invoice.platformFee),
  tax: money(invoice.tax),
  totalAmount: money(invoice.totalAmount),
  currencyCode: invoice.currencyCode,
});

const buildLineItems = (invoice: {
  serviceCharge: Prisma.Decimal;
  traderOfferDiscount: Prisma.Decimal;
  promoDiscount: Prisma.Decimal;
  platformFee: Prisma.Decimal;
  tax: Prisma.Decimal;
}) => {
  const items: Array<{ key: string; label: string; amount: number; type: 'charge' | 'discount' | 'fee' }> = [
    {
      key: 'serviceCharge',
      label: 'Service Charge',
      amount: money(invoice.serviceCharge),
      type: 'charge',
    },
  ];
  if (money(invoice.platformFee) > 0) {
    items.push({
      key: 'platformFee',
      label: 'Platform Fee',
      amount: money(invoice.platformFee),
      type: 'fee',
    });
  }
  if (money(invoice.traderOfferDiscount) > 0) {
    items.push({
      key: 'traderOfferDiscount',
      label: 'Trader Offer',
      amount: -money(invoice.traderOfferDiscount),
      type: 'discount',
    });
  }
  if (money(invoice.promoDiscount) > 0) {
    items.push({
      key: 'promoDiscount',
      label: 'Promo Code',
      amount: -money(invoice.promoDiscount),
      type: 'discount',
    });
  }
  if (money(invoice.tax) > 0) {
    items.push({ key: 'tax', label: 'Tax', amount: money(invoice.tax), type: 'fee' });
  }
  return items;
};

const currencySymbol = (code: string) =>
  ({ EUR: '€', GBP: '£', USD: '$', INR: '₹' }[code] ?? code);

const formatMoneyLabel = (amount: number, currencyCode: string) =>
  `${currencySymbol(currencyCode)}${amount.toFixed(2)}`;

const serializeInvoice = (invoice: InvoiceWithRelations) => {
  const job = invoice.booking.job;
  const trader = invoice.booking.trader;
  const breakdown = serializeInvoiceBreakdown(invoice);
  const serviceProvider =
    trader?.businessName || trader?.user?.fullName || null;
  const orderId = invoice.invoiceNumber || invoice.booking.bookingRef || invoice.id;

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    /** UI "Order ID" e.g. #5864-2824 */
    orderId,
    status: invoice.status,
    bookingId: invoice.bookingId,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    ...breakdown,
    currencySymbol: currencySymbol(invoice.currencyCode),
    totalFormatted: formatMoneyLabel(breakdown.totalAmount, invoice.currencyCode),
    /** Primary CTA label for Payment Details screen. */
    payNowLabel: `Pay Now (${formatMoneyLabel(breakdown.totalAmount, invoice.currencyCode)})`,
    lineItems: buildLineItems(invoice),
    /** Service summary card on invoice screen. */
    serviceSummary: {
      categoryName: job.category?.name ?? null,
      subcategoryName: job.subcategory?.name ?? null,
      title: job.title,
      orderId,
      serviceProvider,
    },
    booking: {
      id: invoice.booking.id,
      bookingRef: invoice.booking.bookingRef,
      status: invoice.booking.status,
      scheduledDate: invoice.booking.scheduledDate,
    },
    job: {
      id: job.id,
      jobRef: job.jobRef,
      title: job.title,
      description: job.description,
      status: job.status,
      scheduledDate: job.scheduledDate,
      timeSlot: job.timeSlot,
      durationLabel: job.durationLabel,
      addressLine: job.addressLine,
      city: job.city,
      postcode: job.postcode,
      category: job.category,
      subcategory: job.subcategory,
      offer: job.offer
        ? {
            id: job.offer.id,
            title: job.offer.title,
            discountType: job.offer.discountType,
            discountValue: money(job.offer.discountValue),
            discountLabel: job.offer.discountLabel,
            currencyCode: job.offer.currencyCode,
          }
        : null,
      offerApplied: Boolean(job.offer),
      coverPhotoUrl: job.photos[0]?.photoUrl ?? null,
    },
    trader: trader
      ? {
          id: trader.id,
          businessName: trader.businessName,
          fullName: trader.user?.fullName ?? null,
          displayName: trader.businessName || trader.user?.fullName || null,
        }
      : null,
    paymentMethods: [
      { key: 'APPLE_PAY', label: 'Apple Pay', enabled: true },
      { key: 'GOOGLE_PAY', label: 'Google Pay', enabled: true },
      { key: 'CARD', label: 'Pay with Credit or Debit Card', enabled: true },
    ],
    paymentStatus: invoice.payments[0]?.status ?? null,
    latestPaymentId: invoice.payments[0]?.id ?? null,
  };
};

const buildReceipt = async (paymentId: string, userId: string) => {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
    include: {
      invoice: {
        include: invoiceOwnershipInclude,
      },
    },
  });
  if (!payment) throw new NotFoundError('Payment not found.');

  const invoice = payment.invoice;
  const job = invoice.booking.job;
  const trader = invoice.booking.trader;
  const amountPaid = money(payment.amount);
  const isPaid = payment.status === PaymentStatus.COMPLETED;

  return {
    paymentId: payment.id,
    /** Aliases for success screen. */
    transactionId: payment.transactionRef,
    transactionRef: payment.transactionRef,
    status: payment.status,
    method: payment.method,
    amount: amountPaid,
    amountPaid,
    amountPaidFormatted: formatMoneyLabel(amountPaid, payment.currencyCode),
    currencyCode: payment.currencyCode,
    currencySymbol: currencySymbol(payment.currencyCode),
    paidAt: payment.paidAt,
    cardLast4: payment.cardLast4,
    cardBrand: payment.cardBrand,
    billingType: payment.billingType,
    companyName: payment.companyName,
    title: isPaid ? 'Payment Successful!' : 'Payment Pending',
    /** Success screen timeline: Paid → Confirmed → Service */
    timeline: [
      { key: 'PAID', label: 'Paid', completed: isPaid, at: payment.paidAt },
      {
        key: 'CONFIRMED',
        label: 'Confirmed',
        completed: isPaid,
        at: isPaid ? payment.paidAt : null,
      },
      { key: 'SERVICE', label: 'Service', completed: false, at: null },
    ],
    receiptSummary: {
      transactionId: payment.transactionRef,
      date: payment.paidAt,
      amountPaid,
      amountPaidFormatted: formatMoneyLabel(amountPaid, payment.currencyCode),
    },
    actions: {
      viewJob: invoice.booking.id
        ? { method: 'GET', path: `/bookings/${invoice.booking.id}` }
        : null,
      backToHome: { path: '/' },
    },
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      orderId: invoice.invoiceNumber || invoice.booking.bookingRef,
      status: invoice.status,
      ...serializeInvoiceBreakdown(invoice),
      lineItems: buildLineItems(invoice),
    },
    booking: {
      id: invoice.booking.id,
      bookingRef: invoice.booking.bookingRef,
      status: invoice.booking.status,
      scheduledDate: invoice.booking.scheduledDate,
    },
    job: {
      id: job.id,
      jobRef: job.jobRef,
      title: job.title,
      status: job.status,
      scheduledDate: job.scheduledDate,
      timeSlot: job.timeSlot,
      durationLabel: job.durationLabel,
      addressLine: job.addressLine,
      city: job.city,
      postcode: job.postcode,
      category: job.category,
      subcategory: job.subcategory,
    },
    trader: trader
      ? {
          id: trader.id,
          businessName: trader.businessName,
          fullName: trader.user?.fullName ?? null,
          displayName: trader.businessName || trader.user?.fullName || null,
        }
      : null,
    customer: {
      id: invoice.booking.customer.id,
      fullName: invoice.booking.customer.fullName,
      email: invoice.booking.customer.email,
    },
  };
};

export const getInvoice = async (userId: string, invoiceId: string) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: invoiceOwnershipInclude,
  });
  if (!invoice) throw new NotFoundError('Invoice not found.');
  assertInvoiceOwner(invoice, userId);
  return serializeInvoice(invoice);
};

export const applyPromo = async (userId: string, invoiceId: string, input: ApplyPromoInput) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: invoiceOwnershipInclude,
  });
  if (!invoice) throw new NotFoundError('Invoice not found.');
  assertInvoiceOwner(invoice, userId);

  if (invoice.status !== InvoiceStatus.UNPAID) {
    throw new BadRequestError('Promo codes can only be applied to unpaid invoices.');
  }

  const code = input.code.trim().toUpperCase();
  const promo = await prisma.promoCode.findFirst({
    where: {
      code: { equals: code, mode: 'insensitive' },
    },
  });
  if (!promo || !promo.active) {
    throw new BadRequestError('Invalid or inactive promo code.');
  }

  const now = new Date();
  if (promo.validFrom.getTime() > now.getTime() || promo.validUntil.getTime() < now.getTime()) {
    throw new BadRequestError('This promo code is not currently valid.');
  }

  if (promo.categoryScope) {
    const jobCategoryId = invoice.booking.job.categoryId;
    const jobCategoryName = invoice.booking.job.category.name;
    const scope = promo.categoryScope.trim();
    const matchesId = scope.toLowerCase() === jobCategoryId.toLowerCase();
    const matchesName = scope.toLowerCase() === jobCategoryName.toLowerCase();
    if (!matchesId && !matchesName) {
      throw new BadRequestError('This promo code does not apply to this job category.');
    }
  }

  const serviceCharge = money(invoice.serviceCharge);
  const traderOfferDiscount = money(invoice.traderOfferDiscount);
  const postOffer = Math.max(serviceCharge - traderOfferDiscount, 0);
  const promoDiscount = computePromoDiscount(
    postOffer,
    promo.discountType,
    money(promo.discountValue)
  );

  const breakdown = computeInvoiceBreakdown({
    serviceCharge,
    traderOfferDiscount,
    promoDiscount,
    currencyCode: invoice.currencyCode,
  });

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      promoDiscount: breakdown.promoDiscount,
      platformFee: breakdown.platformFee,
      tax: breakdown.tax,
      totalAmount: breakdown.totalAmount,
    },
    include: invoiceOwnershipInclude,
  });

  return {
    ...serializeInvoice(updated),
    promoCode: promo.code,
  };
};

export const createPaymentIntent = async (userId: string, input: CreatePaymentIntentInput) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
    include: invoiceOwnershipInclude,
  });
  if (!invoice) throw new NotFoundError('Invoice not found.');
  assertInvoiceOwner(invoice, userId);

  if (invoice.status === InvoiceStatus.PAID) {
    throw new BadRequestError('This invoice is already paid.');
  }
  if (invoice.status === InvoiceStatus.REFUNDED) {
    throw new BadRequestError('Cannot pay a refunded invoice.');
  }

  const existingCompleted = invoice.payments.find((p) => p.status === PaymentStatus.COMPLETED);
  if (existingCompleted) {
    throw new BadRequestError('A completed payment already exists for this invoice.');
  }

  const amount = money(invoice.totalAmount);
  const stripePaymentIntentId = `pi_mock_${randomUUID()}`;

  const payment = await prisma.payment.create({
    data: {
      transactionRef: generateTransactionRef(),
      invoiceId: invoice.id,
      userId,
      stripePaymentIntentId,
      method: input.method,
      billingType: input.billingType,
      companyName: input.companyName,
      tinNumber: input.tinNumber,
      serviceCharge: money(invoice.serviceCharge),
      feeAmount: money(invoice.platformFee),
      discountAmount: round2(
        money(invoice.traderOfferDiscount) + money(invoice.promoDiscount)
      ),
      amount,
      currencyCode: invoice.currencyCode,
      status: PaymentStatus.PENDING,
    },
  });

  return {
    paymentId: payment.id,
    transactionId: payment.transactionRef,
    transactionRef: payment.transactionRef,
    clientSecret: `mock_secret_${payment.id}`,
    publishableKey: null,
    amount: money(payment.amount),
    amountFormatted: formatMoneyLabel(money(payment.amount), payment.currencyCode),
    currencyCode: payment.currencyCode,
    currencySymbol: currencySymbol(payment.currencyCode),
    method: payment.method,
    status: payment.status,
    mock: true as const,
    billingAddress: input.billingAddress ?? null,
    invoiceId: invoice.id,
    orderId: invoice.invoiceNumber || invoice.booking.bookingRef,
    payNowLabel: `Pay Now (${formatMoneyLabel(money(payment.amount), payment.currencyCode)})`,
  };
};

export const confirmPayment = async (
  userId: string,
  paymentId: string,
  input: ConfirmPaymentInput
) => {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
    include: { invoice: true },
  });
  if (!payment) throw new NotFoundError('Payment not found.');

  if (payment.status === PaymentStatus.COMPLETED) {
    return buildReceipt(payment.id, userId);
  }
  if (payment.status === PaymentStatus.FAILED) {
    throw new BadRequestError('This payment has failed and cannot be confirmed.');
  }
  if (payment.invoice.status === InvoiceStatus.PAID) {
    throw new BadRequestError('Invoice is already paid.');
  }

  const paidAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.COMPLETED,
        paidAt,
        cardLast4: input.cardLast4,
        cardBrand: input.cardBrand,
      },
    });

    await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: { status: InvoiceStatus.PAID },
    });
  });

  return buildReceipt(payment.id, userId);
};

export const getPaymentReceipt = async (userId: string, paymentId: string) => {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
  });
  if (!payment) throw new NotFoundError('Payment not found.');
  if (payment.status !== PaymentStatus.COMPLETED) {
    throw new BadRequestError('Receipt is available after payment is completed.');
  }
  return buildReceipt(paymentId, userId);
};

export const getBooking = async (userId: string, bookingId: string) => {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, customerId: userId },
    include: {
      job: {
        include: {
          category: { select: { id: true, name: true } },
          subcategory: { select: { id: true, name: true } },
          photos: { orderBy: { createdAt: 'asc' } },
          offer: {
            select: {
              id: true,
              title: true,
              discountLabel: true,
              discountType: true,
              discountValue: true,
            },
          },
          address: true,
        },
      },
      trader: {
        select: {
          id: true,
          businessName: true,
          profilePhotoUrl: true,
          user: { select: { fullName: true } },
        },
      },
      invoice: {
        include: {
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  });

  if (!booking) throw new NotFoundError('Booking not found.');

  const latestPayment = booking.invoice?.payments[0] ?? null;

  const traderDisplayName =
    booking.trader.businessName || booking.trader.user?.fullName || null;

  return {
    id: booking.id,
    bookingRef: booking.bookingRef,
    status: booking.status,
    scheduledDate: booking.scheduledDate,
    createdAt: booking.createdAt,
    job: {
      id: booking.job.id,
      jobRef: booking.job.jobRef,
      title: booking.job.title,
      description: booking.job.description,
      status: booking.job.status,
      scheduledDate: booking.job.scheduledDate,
      timeSlot: booking.job.timeSlot,
      durationLabel: booking.job.durationLabel,
      phoneNumber: booking.job.phoneNumber,
      addressLine: booking.job.addressLine,
      city: booking.job.city,
      postcode: booking.job.postcode,
      latitude: booking.job.latitude,
      longitude: booking.job.longitude,
      serviceCharge:
        booking.job.serviceCharge != null ? money(booking.job.serviceCharge) : null,
      category: booking.job.category,
      subcategory: booking.job.subcategory,
      offerApplied: Boolean(booking.job.offer),
      offer: booking.job.offer
        ? {
            id: booking.job.offer.id,
            title: booking.job.offer.title,
            discountLabel: booking.job.offer.discountLabel,
            discountType: booking.job.offer.discountType,
            discountValue: money(booking.job.offer.discountValue),
            bannerTitle: booking.job.offer.title,
            bannerSubtitle: booking.job.offer.discountLabel,
          }
        : null,
      photos: booking.job.photos.map((p) => ({
        id: p.id,
        photoUrl: p.photoUrl,
      })),
      coverPhotoUrl: booking.job.photos[0]?.photoUrl ?? null,
      address: booking.job.address
        ? {
            id: booking.job.address.id,
            label: booking.job.address.label ?? booking.job.address.addressType,
            addressLine1: booking.job.address.addressLine1,
            city: booking.job.address.city,
            eircode: booking.job.address.eircode,
          }
        : null,
    },
    trader: {
      id: booking.trader.id,
      businessName: booking.trader.businessName,
      profilePhotoUrl: booking.trader.profilePhotoUrl,
      fullName: booking.trader.user?.fullName ?? null,
      displayName: traderDisplayName,
    },
    invoice: booking.invoice
      ? {
          id: booking.invoice.id,
          invoiceNumber: booking.invoice.invoiceNumber,
          orderId: booking.invoice.invoiceNumber || booking.bookingRef,
          status: booking.invoice.status,
          ...serializeInvoiceBreakdown(booking.invoice),
          lineItems: buildLineItems(booking.invoice),
          totalFormatted: formatMoneyLabel(
            money(booking.invoice.totalAmount),
            booking.invoice.currencyCode
          ),
        }
      : null,
    payment: latestPayment
      ? {
          id: latestPayment.id,
          transactionId: latestPayment.transactionRef,
          transactionRef: latestPayment.transactionRef,
          status: latestPayment.status,
          method: latestPayment.method,
          amount: money(latestPayment.amount),
          amountPaid: money(latestPayment.amount),
          paidAt: latestPayment.paidAt,
        }
      : null,
  };
};
