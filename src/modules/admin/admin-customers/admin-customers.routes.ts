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
 *     tags: ['👥 [Admin Customer] 1. All Customers Directory']
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
 *     summary: List Customers Directory (Paginated, Search, Status & Country Filters)
 *     tags: ['👥 [Admin Customer] 1. All Customers Directory']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by customer name, email, mobile, or customer ID (CUST-####).
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, INACTIVE, PENDING, BLOCKED, SUSPENDED] }
 *       - in: query
 *         name: country
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Customer directory retrieved matching Screenshot 1 format.
 */
router.get('/customers', validate(customerFilterSchema), customerAdminController.listCustomers);

/**
 * @swagger
 * /admin/customers:
 *   post:
 *     summary: Create new Customer Profile
 *     tags: ['👥 [Admin Customer] 1. All Customers Directory']
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

router.get('/customers/deletion-requests/stats', customerAdminController.getDeletionRequestStats);

router.get(
  '/customers/deletion-requests',
  validate(deletionRequestFilterSchema),
  customerAdminController.listDeletionRequests
);

router.get('/customers/deletion-requests/:id', customerAdminController.getDeletionRequest);

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
 *     tags: ['👥 [Admin Customer] 1. All Customers Directory']
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
 *     tags: ['👥 [Admin Customer] 1. All Customers Directory']
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
 *     tags: ['👥 [Admin Customer] 1. All Customers Directory']
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
 *     tags: ['💳 [Admin Customer] 3. Payment & Billing Management']
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
 *     summary: List Payment Transactions (Paginated, Search, Status & Method Filters)
 *     tags: ['💳 [Admin Customer] 3. Payment & Billing Management']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by transaction reference (TXN-#######), customer, job, or trader.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, COMPLETED, FAILED, REFUNDED] }
 *       - in: query
 *         name: method
 *         schema: { type: string }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [newest, oldest], default: newest }
 *     responses:
 *       200:
 *         description: Customer payment transactions retrieved matching Screenshots 1 & 2 format.
 */
router.get('/customer-payments/transactions', validate(paymentTransactionFilterSchema), customerAdminController.listPaymentTransactions);

/**
 * @swagger
 * /admin/customer-payments/transactions/{id}:
 *   get:
 *     summary: Get single Customer Payment Transaction detail modal view by ID
 *     tags: ['💳 [Admin Customer] 3. Payment & Billing Management']
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
 *     summary: List Billing & Invoices (Paginated, Search & Status Filters)
 *     tags: ['💳 [Admin Customer] 3. Payment & Billing Management']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by invoice number (INV-####-###), customer, job, or trader.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [UNPAID, PAID, REFUNDED] }
 *     responses:
 *       200:
 *         description: Customer billing invoices retrieved matching Screenshot 3 format.
 */
router.get('/customer-payments/invoices', validate(invoiceFilterSchema), customerAdminController.listBillingInvoices);

/**
 * @swagger
 * /admin/customer-payments/invoices/{id}:
 *   get:
 *     summary: Get single Tax Invoice detail view by ID
 *     tags: ['💳 [Admin Customer] 3. Payment & Billing Management']
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
 *     summary: List Refunds Management Queue (Paginated, Search & Status Filters)
 *     tags: ['💳 [Admin Customer] 3. Payment & Billing Management']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by refund reference (REF-####), TXN ID, customer, or job.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, COMPLETED, REJECTED] }
 *     responses:
 *       200:
 *         description: Refunds queue list retrieved matching Screenshot 4 format.
 */
router.get('/customer-payments/refunds', validate(refundFilterSchema), customerAdminController.listRefundsQueue);

/**
 * @swagger
 * /admin/customer-payments/refunds/{id}/process:
 *   patch:
 *     summary: Process Customer Payment Refund (Approve & Execute Refund)
 *     tags: ['💳 [Admin Customer] 3. Payment & Billing Management']
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
 *     tags: ['💳 [Admin Customer] 3. Payment & Billing Management']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Loyalty points summary (Available Points, Lifetime Earned, Points Redeemed) and recent activity feed matching Screenshot 5 format.
 */
router.get('/customer-payments/loyalty', customerAdminController.getLoyaltyRewardsSummary);

export default router;
