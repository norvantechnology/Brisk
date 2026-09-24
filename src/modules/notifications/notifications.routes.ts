import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './notifications.controller';
import {
  notificationIdParamSchema,
  notificationListQuerySchema,
} from './notifications.validation';

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: |
 *       In-app notifications for **Trader Portal** and **Customer** (authenticated User).
 *       Auth: Bearer access token from `POST /auth/login`.
 *       Admin inbox is under **Admin / Notifications**.
 *
 * components:
 *   schemas:
 *     AppNotificationItem:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid, example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }
 *         type: { type: string, example: 'TRADER_PROFILE_APPROVED' }
 *         title: { type: string, example: 'Profile approved' }
 *         message: { type: string, example: 'Your BRISK trader profile has been approved.' }
 *         read: { type: boolean, example: false }
 *         actionUrl: { type: string, nullable: true, example: '/dashboard', description: 'Detail/screen route — FE navigates with router.push(actionUrl); no per-type routing.' }
 *         data:
 *           type: object
 *           additionalProperties: true
 *           example: { title: 'Profile approved', message: 'Your BRISK trader profile has been approved.' }
 *         createdAt: { type: string, format: date-time, example: '2026-09-24T10:00:00.000Z' }
 *     AppNotificationListData:
 *       type: object
 *       properties:
 *         notifications:
 *           type: array
 *           items: { $ref: '#/components/schemas/AppNotificationItem' }
 *         unreadCount: { type: integer, example: 3 }
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: List my notifications (paginated)
 *     description: |
 *       Trader Portal / Customer inbox.
 *       Query: `page`, `limit` (max 100, default 20), `unreadOnly=true|false`, `type`.
 *     tags: ['Notifications']
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
 *         description: When true, return only unread notifications.
 *       - in: query
 *         name: type
 *         schema: { type: string, example: 'TRADER_PROFILE_APPROVED' }
 *     responses:
 *       200:
 *         description: Paginated notification list
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Notifications retrieved successfully.
 *               data:
 *                 notifications:
 *                   - id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
 *                     type: TRADER_PROFILE_APPROVED
 *                     title: Profile approved
 *                     message: Your BRISK trader profile has been approved. You can now use the app.
 *                     read: false
 *                     actionUrl: null
 *                     data:
 *                       title: Profile approved
 *                       message: Your BRISK trader profile has been approved. You can now use the app.
 *                     createdAt: '2026-09-24T10:00:00.000Z'
 *                 unreadCount: 3
 *               meta:
 *                 total: 12
 *                 page: 1
 *                 limit: 20
 *                 totalPages: 1
 *       401:
 *         description: Missing/invalid token
 */
router.get('/', validate(notificationListQuerySchema), controller.listNotifications);

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: Unread notification badge count
 *     tags: ['Notifications']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Unread notification count retrieved successfully.
 *               data:
 *                 count: 3
 */
router.get('/unread-count', controller.getUnreadCount);

/**
 * @swagger
 * /notifications/read-all:
 *   post:
 *     summary: Mark all my notifications as read
 *     tags: ['Notifications']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All marked read
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: All notifications marked as read.
 *               data:
 *                 updatedCount: 3
 */
router.post('/read-all', controller.markAllAsRead);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark one notification as read
 *     tags: ['Notifications']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notification updated
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Notification marked as read.
 *               data:
 *                 notification:
 *                   id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
 *                   type: TRADER_PROFILE_APPROVED
 *                   title: Profile approved
 *                   message: Your BRISK trader profile has been approved.
 *                   read: true
 *                   actionUrl: null
 *                   data: { title: Profile approved }
 *                   createdAt: '2026-09-24T10:00:00.000Z'
 *       404:
 *         description: Notification not found
 */
router.patch(
  '/:id/read',
  validate(notificationIdParamSchema),
  controller.markAsRead
);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Delete one notification
 *     tags: ['Notifications']
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
 *               message: Notification deleted successfully.
 *               data:
 *                 deleted: true
 *       404:
 *         description: Notification not found
 */
router.delete(
  '/:id',
  validate(notificationIdParamSchema),
  controller.deleteNotification
);

export default router;
