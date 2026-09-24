import { Router } from 'express';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './admin-notifications.controller';
import {
  notificationIdParamSchema,
  notificationListQuerySchema,
} from '../../notifications/notifications.validation';

const router = Router();

router.use(adminAuthMiddleware);

/**
 * @swagger
 * tags:
 *   - name: Admin / Notifications
 *     description: |
 *       Admin Portal in-app notification inbox (paginated).
 *       Auth: Bearer token from `POST /admin/auth/login`.
 *       Trader/Customer inbox: **Notifications** (`/notifications`).
 *
 * components:
 *   schemas:
 *     AdminNotificationItem:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         type: { type: string, example: 'TRADER_OTP_VERIFIED' }
 *         title: { type: string, example: 'New trader verified OTP' }
 *         message: { type: string, example: 'Jenish Kavathiya verified email and mobile OTP.' }
 *         desc: { type: string, description: Alias of message for Admin FE }
 *         read: { type: boolean, example: false }
 *         isRead: { type: boolean, description: Alias of read for Admin FE }
 *         actionUrl: { type: string, nullable: true, example: '/traders/0d5ad2bc-8da7-4872-83bd-bd7a631004ee', description: 'Detail-page route for the related entity. FE should navigate with router.push(actionUrl).' }
 *         data: { type: object, nullable: true, additionalProperties: true, description: 'Includes traderId (Trader.id) and traderUserId when applicable.' }
 *         createdAt: { type: string, format: date-time }
 *         timestamp: { type: string, format: date-time, description: Alias of createdAt }
 */

/**
 * @swagger
 * /admin/notifications:
 *   get:
 *     summary: List admin notifications (paginated)
 *     description: |
 *       Admin Portal inbox for the logged-in admin.
 *       Query: `page`, `limit` (default 20, max 100), `unreadOnly`, `type`, `search`.
 *       **actionUrl** is always a detail route when an entity id is known, e.g.
 *       `/traders/{traderId}` — navigate directly; document verification is a modal on that page.
 *     tags: ['Admin / Notifications']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, example: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, example: 20 }
 *       - in: query
 *         name: unreadOnly
 *         schema: { type: boolean, example: true }
 *       - in: query
 *         name: type
 *         schema: { type: string, example: 'TRADER_OTP_VERIFIED' }
 *       - in: query
 *         name: search
 *         schema: { type: string, example: 'trader' }
 *         description: Search title, message, or type.
 *     responses:
 *       200:
 *         description: Paginated admin notifications
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Admin notifications retrieved successfully.
 *               data:
 *                 notifications:
 *                   - id: b2c3d4e5-f6a7-8901-bcde-f12345678901
 *                     type: TRADER_OTP_VERIFIED
 *                     title: New trader verified OTP
 *                     message: Jenish Kavathiya verified email and mobile OTP.
 *                     desc: Jenish Kavathiya verified email and mobile OTP.
 *                     read: false
 *                     isRead: false
 *                     actionUrl: /traders/0d5ad2bc-8da7-4872-83bd-bd7a631004ee
 *                     data: { traderId: '0d5ad2bc-8da7-4872-83bd-bd7a631004ee', traderUserId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }
 *                     createdAt: '2026-09-24T11:00:00.000Z'
 *                     timestamp: '2026-09-24T11:00:00.000Z'
 *                 unreadCount: 2
 *               meta:
 *                 total: 8
 *                 page: 1
 *                 limit: 20
 *                 totalPages: 1
 *       401:
 *         description: Missing/invalid admin token
 */
router.get('/', validate(notificationListQuerySchema), controller.listNotifications);

/**
 * @swagger
 * /admin/notifications/types:
 *   get:
 *     summary: List admin notification types (for FE filters)
 *     description: |
 *       Returns the catalog of admin notification `type` values with labels/categories
 *       plus `count` / `unreadCount` for the logged-in admin.
 *       Use `type` from each item as `GET /admin/notifications?type=...`.
 *     tags: ['Admin / Notifications']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification type filter catalog
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Admin notification types retrieved successfully.
 *               data:
 *                 types:
 *                   - type: TRADER_OTP_VERIFIED
 *                     label: OTP verified
 *                     category: traders
 *                     description: Trader verified email and mobile OTP.
 *                     count: 2
 *                     unreadCount: 1
 *                   - type: TRADER_PENDING_APPROVAL
 *                     label: Pending approval
 *                     category: verification
 *                     description: Trader submitted onboarding and awaits verification.
 *                     count: 1
 *                     unreadCount: 0
 *                   - type: TRADER_DOCUMENT_UPLOADED
 *                     label: Document uploaded
 *                     category: verification
 *                     description: Trader uploaded or replaced a verification document.
 *                     count: 3
 *                     unreadCount: 2
 *                   - type: SYSTEM
 *                     label: System
 *                     category: system
 *                     description: Platform / system notice.
 *                     count: 0
 *                     unreadCount: 0
 */
router.get('/types', controller.listTypes);

/**
 * @swagger
 * /admin/notifications/unread-count:
 *   get:
 *     summary: Admin unread badge count
 *     tags: ['Admin / Notifications']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Unread admin notification count retrieved successfully.
 *               data:
 *                 count: 2
 */
router.get('/unread-count', controller.getUnreadCount);

/**
 * @swagger
 * /admin/notifications/read-all:
 *   post:
 *     summary: Mark all admin notifications as read
 *     tags: ['Admin / Notifications']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All marked read
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: All admin notifications marked as read.
 *               data:
 *                 updatedCount: 2
 */
router.post('/read-all', controller.markAllAsRead);

/**
 * @swagger
 * /admin/notifications/{id}/read:
 *   patch:
 *     summary: Mark one admin notification as read
 *     tags: ['Admin / Notifications']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Admin notification marked as read.
 *               data:
 *                 notification:
 *                   id: b2c3d4e5-f6a7-8901-bcde-f12345678901
 *                   type: TRADER_OTP_VERIFIED
 *                   title: New trader verified OTP
 *                   message: Jenish Kavathiya verified email and mobile OTP.
 *                   read: true
 *                   isRead: true
 *                   actionUrl: /traders/0d5ad2bc-8da7-4872-83bd-bd7a631004ee
 *                   createdAt: '2026-09-24T11:00:00.000Z'
 *       404:
 *         description: Not found
 */
router.patch(
  '/:id/read',
  validate(notificationIdParamSchema),
  controller.markAsRead
);

/**
 * @swagger
 * /admin/notifications/{id}:
 *   delete:
 *     summary: Delete one admin notification
 *     tags: ['Admin / Notifications']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Deleted
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Admin notification deleted successfully.
 *               data:
 *                 deleted: true
 */
router.delete(
  '/:id',
  validate(notificationIdParamSchema),
  controller.deleteNotification
);

export default router;
