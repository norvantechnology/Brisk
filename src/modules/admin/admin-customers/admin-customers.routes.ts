import { Router } from 'express';
import * as customerAdminController from './admin-customers.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerFilterSchema,
  deletionRequestFilterSchema,
  updateDeletionRequestSchema,
  paymentTransactionFilterSchema,
  invoiceFilterSchema,
  refundFilterSchema,
  processRefundSchema,
} from './admin-customers.validation';

const router = Router();

// Apply Admin Auth Middleware across all Customers admin routes
router.use(adminAuthMiddleware);

// ==========================================
// CUSTOMER DIRECTORY ROUTES
// ==========================================

/**
 * @swagger
 * /admin/customers/stats:
 *   get:
 *     summary: Retrieve Customer Directory KPI Stat Cards
 *     tags: ['Admin / Customers']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stat metrics retrieved (Total Customers, Active, Inactive/Blocked, New This Month, Total Revenue, Avg Order Value).
 */
router.get('/customers/stats', customerAdminController.getCustomerDirectoryStats);

/**
 * @swagger
 * /admin/customers:
 *   get:
 *     summary: List Customers Directory (search, filter and sort on every column)
 *     tags: ['Admin / Customers']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AdminPage'
 *       - $ref: '#/components/parameters/AdminLimit'
 *       - in: query
 *         name: search
 *         schema: { type: string, example: 'Murphy' }
 *         description: Search by customer name, email, mobile, or customer code.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, INACTIVE, PENDING, BLOCKED, SUSPENDED] }
 *       - in: query
 *         name: country
 *         schema: { type: string, example: Ireland }
 *         description: Partial, case-insensitive.
 *       - in: query
 *         name: city
 *         schema: { type: string, example: Dublin }
 *         description: Partial, case-insensitive.
 *       - in: query
 *         name: emailVerified
 *         schema: { type: boolean }
 *       - in: query
 *         name: mobileVerified
 *         schema: { type: boolean }
 *       - in: query
 *         name: joinedFrom
 *         schema: { type: string, example: '2026-09-01' }
 *         description: Inclusive start of joinedAt (ISO date or datetime).
 *       - in: query
 *         name: joinedTo
 *         schema: { type: string, example: '2026-09-30' }
 *         description: Inclusive end of joinedAt (ISO date or datetime).
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [customerCode, fullName, email, mobileNumber, city, country, totalOrders, totalSpent, status, emailVerified, mobileVerified, joinedAt]
 *           default: joinedAt
 *         description: Table column to sort by (`city`/`country` = location.*). Default newest joined first.
 *       - $ref: '#/components/parameters/AdminSortOrder'
 *     responses:
 *       200:
 *         description: Customer directory page.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Customers retrieved successfully.
 *               data:
 *                 meta: { total: 42, page: 1, limit: 10, totalPages: 5 }
 *                 customers:
 *                   - id: 1f2e3d4c-0000-4000-8000-000000000001
 *                     customerCode: CUS-1001
 *                     fullName: Sarah Murphy
 *                     email: sarah.murphy@example.com
 *                     mobileNumber: '+353871234567'
 *                     alternatePhone: null
 *                     profilePhotoUrl: 'https://api.brisk.ie/uploads/profile/sarah.jpg'
 *                     location: { city: Dublin, country: Ireland }
 *                     totalOrders: 6
 *                     totalSpent: 845.5
 *                     status: ACTIVE
 *                     mobileVerified: true
 *                     emailVerified: true
 *                     preferredLanguage: English (UK)
 *                     preferredTimeSlot: 'Morning (09:00 - 12:00)'
 *                     joinedAt: '2026-07-14T09:30:00.000Z'
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 */
router.get('/customers', validate(customerFilterSchema), customerAdminController.listCustomers);

/**
 * @swagger
 * /admin/customers:
 *   post:
 *     summary: Create new Customer Profile
 *     tags: ['Admin / Customers']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - primaryPhone
 *             properties:
 *               fullName: { type: string, example: 'Sarah Murphy' }
 *               email: { type: string, example: 'sarah.murphy@example.com' }
 *               primaryPhone: { type: string, example: '+447700900881' }
 *               alternatePhone: { type: string, example: '+447700900882' }
 *               profilePhotoUrl: { type: string, example: 'https://cdn.brisk.com/avatars/sarah.jpg' }
 *               status: { type: string, enum: [ACTIVE, INACTIVE, PENDING, SUSPENDED], example: 'ACTIVE' }
 *               emailVerified: { type: boolean, example: true }
 *               phoneVerified: { type: boolean, example: true }
 *               preferredLanguage: { type: string, example: 'English (UK)' }
 *               preferredTimeSlot: { type: string, example: 'Morning (09:00 - 12:00)' }
 *               emailNotifications: { type: boolean, example: true }
 *               smsAlerts: { type: boolean, example: true }
 *               promoNotifications: { type: boolean, example: false }
 *     responses:
 *       201:
 *         description: Customer profile created successfully.
 *       409:
 *         description: Customer email or primary phone number already exists.
 */
router.post('/customers', validate(createCustomerSchema), customerAdminController.createCustomer);

// ==========================================
// ACCOUNT DELETION REQUESTS ROUTES (must be before /customers/:id)
// ==========================================

/**
 * @swagger
 * /admin/customers/deletion-requests/stats:
 *   get:
 *     summary: Deletion request queue KPI stats
 *     tags: ['Admin / Deletion Requests']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deletion request stats retrieved.
 */
router.get('/customers/deletion-requests/stats', customerAdminController.getDeletionRequestStats);

/**
 * @swagger
 * /admin/customers/deletion-requests:
 *   get:
 *     summary: List GDPR account deletion requests (search, filter and sort on every column)
 *     tags: ['Admin / Deletion Requests']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AdminPage'
 *       - $ref: '#/components/parameters/AdminLimit'
 *       - in: query
 *         name: search
 *         schema: { type: string, example: 'DEL-1001' }
 *         description: Search by request ref, reason, customer name, email or phone.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, UNDER_REVIEW, APPROVED, REJECTED, COMPLETED] }
 *       - in: query
 *         name: reason
 *         schema: { type: string }
 *         description: Reason contains (case-insensitive).
 *       - $ref: '#/components/parameters/AdminDateFrom'
 *       - $ref: '#/components/parameters/AdminDateTo'
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [requestRef, customerName, email, phone, reason, requestedAt, status, reviewedBy]
 *           default: requestedAt
 *       - $ref: '#/components/parameters/AdminSortOrder'
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [newest, oldest] }
 *         description: Legacy requestedAt order — ignored when `sortBy` is sent.
 *     responses:
 *       200:
 *         description: Deletion requests page. `from`/`to` filter `requestedAt`.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Account deletion requests retrieved successfully.
 *               data:
 *                 meta: { total: 3, page: 1, limit: 10, totalPages: 1 }
 *                 requests:
 *                   - id: 2b3c4d5e-0000-4000-8000-000000000010
 *                     requestRef: DEL-1001
 *                     customer:
 *                       id: 1f2e3d4c-0000-4000-8000-000000000001
 *                       customerCode: CUS-1001
 *                       fullName: Sarah Murphy
 *                       profilePhotoUrl: null
 *                     email: sarah.murphy@example.com
 *                     phone: '+353871234567'
 *                     reason: No longer need the service
 *                     requestedAt: '2026-09-20T11:00:00.000Z'
 *                     status: REJECTED
 *                     adminNote: Customer has an active job.
 *                     adminNotes: Customer has an active job.
 *                     rejectionReason: Customer has an active job.
 *                     reviewedByLabel: Snehal Patel (SUPER_ADMIN)
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 */
router.get(
  '/customers/deletion-requests',
  validate(deletionRequestFilterSchema),
  customerAdminController.listDeletionRequests
);

/**
 * @swagger
 * /admin/customers/deletion-requests/{id}:
 *   get:
 *     summary: Get deletion request detail
 *     tags: ['Admin / Deletion Requests']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Deletion request detail retrieved.
 *       404:
 *         description: Request not found.
 */
router.get('/customers/deletion-requests/:id', customerAdminController.getDeletionRequest);

/**
 * @swagger
 * /admin/customers/deletion-requests/{id}:
 *   patch:
 *     summary: Review / process a deletion request
 *     tags: ['Admin / Deletion Requests']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string }
 *               adminNotes: { type: string }
 *     responses:
 *       200:
 *         description: Deletion request updated.
 */
router.patch(
  '/customers/deletion-requests/:id',
  validate(updateDeletionRequestSchema),
  customerAdminController.updateDeletionRequest
);

/**
 * @swagger
 * /admin/customers/{id}:
 *   get:
 *     summary: Get Customer Profile detail by ID
 *     tags: ['Admin / Customers']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Customer profile retrieved with addresses, properties, and total orders/spent summary.
 *       404:
 *         description: Customer not found.
 */
router.get('/customers/:id', customerAdminController.getCustomer);

/**
 * @swagger
 * /admin/customers/{id}:
 *   patch:
 *     summary: Update Customer Profile
 *     tags: ['Admin / Customers']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               email: { type: string }
 *               primaryPhone: { type: string }
 *               status: { type: string, enum: [ACTIVE, INACTIVE, PENDING, SUSPENDED] }
 *               emailVerified: { type: boolean }
 *               phoneVerified: { type: boolean }
 *     responses:
 *       200:
 *         description: Customer profile updated successfully.
 *       404:
 *         description: Customer not found.
 */
router.patch('/customers/:id', validate(updateCustomerSchema), customerAdminController.updateCustomer);

/**
 * @swagger
 * /admin/customers/{id}:
 *   delete:
 *     summary: Delete Customer Profile
 *     tags: ['Admin / Customers']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Customer profile deleted successfully.
 *       404:
 *         description: Customer not found.
 */
router.delete('/customers/:id', customerAdminController.deleteCustomer);

// ==========================================
// CUSTOMER PAYMENT & BILLING MANAGEMENT ROUTES (Screenshots 1, 2, 3, 4, 5)
// ==========================================

/**
 * @swagger
 * /admin/customer-payments/stats:
 *   get:
 *     summary: Retrieve Payment & Billing Header KPI Stat Cards
 *     tags: ['Admin / Payments']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Header stat cards retrieved (Available Cash, Default Method, Pending Payments, Pending Refunds, Last Payment Date).
 */
router.get('/customer-payments/stats', customerAdminController.getCustomerPaymentHeaderStats);

/**
 * @swagger
 * /admin/customer-payments/transactions:
 *   get:
 *     summary: List Payment Transactions (search, filter and sort on every column)
 *     tags: ['Admin / Payments']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AdminPage'
 *       - $ref: '#/components/parameters/AdminLimit'
 *       - in: query
 *         name: search
 *         schema: { type: string, example: 'TXN-' }
 *         description: Search by transaction reference, customer, job, or trader.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, COMPLETED, FAILED] }
 *       - in: query
 *         name: method
 *         schema: { type: string, enum: [CARD, APPLE_PAY, GOOGLE_PAY] }
 *         description: Case-insensitive.
 *       - in: query
 *         name: customerId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: traderId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - $ref: '#/components/parameters/AdminDateFrom'
 *       - $ref: '#/components/parameters/AdminDateTo'
 *       - $ref: '#/components/parameters/AdminMinAmount'
 *       - $ref: '#/components/parameters/AdminMaxAmount'
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [transactionRef, date, customerName, jobTitle, bookingRef, categoryName, traderName, serviceCharge, discount, fee, totalPaid, paymentMethod, status]
 *           default: date
 *       - $ref: '#/components/parameters/AdminSortOrder'
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [newest, oldest] }
 *         description: Legacy date order — ignored when `sortBy` is sent.
 *     responses:
 *       200:
 *         description: Transactions page. `from`/`to` filter created date; `minAmount`/`maxAmount` filter totalPaid.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Payment transactions retrieved successfully.
 *               data:
 *                 meta: { total: 120, page: 1, limit: 10, totalPages: 12 }
 *                 transactions:
 *                   - id: 3c4d5e6f-0000-4000-8000-000000000020
 *                     transactionRef: TXN-8F2A91C0
 *                     date: '2026-09-28T14:05:00.000Z'
 *                     currencyCode: EUR
 *                     customer:
 *                       id: 1f2e3d4c-0000-4000-8000-000000000001
 *                       customerCode: CUS-1001
 *                       fullName: Sarah Murphy
 *                     jobBooking:
 *                       title: Kitchen tap replacement
 *                       bookingRef: BK-10023
 *                       categoryName: Plumbing
 *                     trader:
 *                       id: 4d5e6f70-0000-4000-8000-000000000030
 *                       fullName: John Byrne
 *                       traderCode: TRD-2001
 *                     serviceCharge: 120
 *                     serviceChargeMoney: { amount: 120, currency: EUR, formatted: '€120.00', isHistorical: true }
 *                     feeOffer: { discount: 0, fee: 24 }
 *                     totalPaid: 144
 *                     totalPaidMoney: { amount: 144, currency: EUR, formatted: '€144.00', isHistorical: true }
 *                     paymentMethod: { method: CARD, brand: visa, last4: '4242' }
 *                     status: COMPLETED
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 */
router.get('/customer-payments/transactions', validate(paymentTransactionFilterSchema), customerAdminController.listPaymentTransactions);

/**
 * @swagger
 * /admin/customer-payments/transactions/{id}:
 *   get:
 *     summary: Get single Customer Payment Transaction detail modal view by ID
 *     tags: ['Admin / Payments']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Payment transaction details retrieved with Job & Booking information, customer/trader links, amount breakdown, individual billing address, and invoice reference matching Modal Screenshot 3.
 *       404:
 *         description: Payment transaction not found.
 */
router.get('/customer-payments/transactions/:id', customerAdminController.getTransaction);

/**
 * @swagger
 * /admin/customer-payments/invoices:
 *   get:
 *     summary: List Billing & Invoices (search, filter and sort on every column)
 *     tags: ['Admin / Payments']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AdminPage'
 *       - $ref: '#/components/parameters/AdminLimit'
 *       - in: query
 *         name: search
 *         schema: { type: string, example: 'INV-' }
 *         description: Search by invoice number, customer, job, or trader.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [UNPAID, PAID, REFUNDED] }
 *       - in: query
 *         name: customerId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: traderId
 *         schema: { type: string, format: uuid }
 *       - $ref: '#/components/parameters/AdminDateFrom'
 *       - $ref: '#/components/parameters/AdminDateTo'
 *       - $ref: '#/components/parameters/AdminMinAmount'
 *       - $ref: '#/components/parameters/AdminMaxAmount'
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [invoiceNumber, customerName, jobTitle, traderName, invoiceDate, amount, status]
 *           default: invoiceDate
 *       - $ref: '#/components/parameters/AdminSortOrder'
 *     responses:
 *       200:
 *         description: Invoices page. `from`/`to` filter invoiceDate; `minAmount`/`maxAmount` filter amount.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Billing invoices retrieved successfully.
 *               data:
 *                 meta: { total: 58, page: 1, limit: 10, totalPages: 6 }
 *                 invoices:
 *                   - id: 5e6f7081-0000-4000-8000-000000000040
 *                     invoiceNumber: INV-2026-0042
 *                     customerName: Sarah Murphy
 *                     jobBookingTitle: Kitchen tap replacement
 *                     traderName: John Byrne
 *                     invoiceDate: '2026-09-28T14:00:00.000Z'
 *                     currencyCode: EUR
 *                     amount: 144
 *                     amountMoney: { amount: 144, currency: EUR, formatted: '€144.00', isHistorical: true }
 *                     status: PAID
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 */
router.get('/customer-payments/invoices', validate(invoiceFilterSchema), customerAdminController.listBillingInvoices);

/**
 * @swagger
 * /admin/customer-payments/invoices/{id}:
 *   get:
 *     summary: Get single Tax Invoice detail view by ID
 *     tags: ['Admin / Payments']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Full Tax Invoice details retrieved with company header, VAT registration #, customer details, verified trader partner info, service items, tax breakdown, convenience fee, promo discount, and digital verification QR reference matching Modal Screenshot 2.
 *       404:
 *         description: Invoice record not found.
 */
router.get('/customer-payments/invoices/:id', customerAdminController.getInvoice);

/**
 * @swagger
 * /admin/customer-payments/refunds:
 *   get:
 *     summary: List Refunds Management Queue (search, filter and sort on every column)
 *     tags: ['Admin / Payments']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AdminPage'
 *       - $ref: '#/components/parameters/AdminLimit'
 *       - in: query
 *         name: search
 *         schema: { type: string, example: 'REF-' }
 *         description: Search by refund reference, transaction ref, customer, or job.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, COMPLETED, REJECTED] }
 *       - in: query
 *         name: customerId
 *         schema: { type: string, format: uuid }
 *       - $ref: '#/components/parameters/AdminDateFrom'
 *       - $ref: '#/components/parameters/AdminDateTo'
 *       - $ref: '#/components/parameters/AdminMinAmount'
 *       - $ref: '#/components/parameters/AdminMaxAmount'
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [refundRef, transactionRef, customerName, jobTitle, originalAmount, refundAmount, reason, status, requestedAt]
 *           default: requestedAt
 *       - $ref: '#/components/parameters/AdminSortOrder'
 *     responses:
 *       200:
 *         description: Refunds page. `from`/`to` filter requestedAt; `minAmount`/`maxAmount` filter refundAmount.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Refunds management queue retrieved successfully.
 *               data:
 *                 meta: { total: 4, page: 1, limit: 10, totalPages: 1 }
 *                 refunds:
 *                   - id: 6f708192-0000-4000-8000-000000000050
 *                     refundRef: REF-1004
 *                     transactionRef: TXN-8F2A91C0
 *                     customerName: Sarah Murphy
 *                     jobBookingTitle: Kitchen tap replacement
 *                     currencyCode: EUR
 *                     originalAmount: 144
 *                     originalAmountMoney: { amount: 144, currency: EUR, formatted: '€144.00', isHistorical: true }
 *                     refundAmount: 50
 *                     refundAmountMoney: { amount: 50, currency: EUR, formatted: '€50.00', isHistorical: true }
 *                     reason: Job partly completed
 *                     status: PENDING
 *                     adminNote: null
 *                     requestedAt: '2026-09-29T10:15:00.000Z'
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 */
router.get('/customer-payments/refunds', validate(refundFilterSchema), customerAdminController.listRefundsQueue);

/**
 * @swagger
 * /admin/customer-payments/refunds/{id}/process:
 *   patch:
 *     summary: Process Customer Payment Refund (Approve & Execute Refund)
 *     tags: ['Admin / Payments']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, APPROVED, COMPLETED, REJECTED]
 *                 example: COMPLETED
 *               notes:
 *                 type: string
 *                 example: Processed customer refund return to original payment method.
 *     responses:
 *       200:
 *         description: Refund status updated successfully and audit log logged.
 *       404:
 *         description: Refund record not found.
 */
router.patch('/customer-payments/refunds/:id/process', validate(processRefundSchema), customerAdminController.processRefund);

/**
 * @swagger
 * /admin/customer-payments/loyalty:
 *   get:
 *     summary: Retrieve Customer Loyalty & Rewards Summary and Activity Feed
 *     tags: ['Admin / Payments']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Loyalty points summary (Available Points, Lifetime Earned, Points Redeemed) and recent activity feed matching Screenshot 5 format.
 */
router.get('/customer-payments/loyalty', customerAdminController.getLoyaltyRewardsSummary);

export default router;
