import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './notifications.controller';
import {
  notificationIdParamSchema,
  notificationListQuerySchema,
  notificationReadAllQuerySchema,
  registerDeviceSchema,
  unregisterDeviceSchema,
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
 *         type: { type: string, example: 'NEW_MATCHING_JOB', description: 'See GET /notifications/types for every type.' }
 *         tab: { type: string, enum: [REGULAR, BRISK] }
 *         section: { type: string, enum: [NEW_MATCHING_JOBS, QUOTATIONS, INCOMING_CHATS, BOOKING_UPDATES, ACCOUNT_UPDATES, OTHER, COMPANY_UPDATES] }
 *         sectionTitle: { type: string, example: 'New Matching Jobs' }
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
 *       Query: `page`, `limit` (max 100, default 20), `unreadOnly=true|false`, `type`,
 *       `tab=REGULAR|BRISK`, `section` (e.g. `NEW_MATCHING_JOBS`).
 *       Read notifications stay in the list (`read: true`); only DELETE removes them.
 *       `sections` = the same page grouped under section headers (display order);
 *       `unreadByTab` = badge per tab. Live updates: socket `notification:new` (`notification` = same item shape).
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
 *       - in: query
 *         name: tab
 *         schema: { type: string, enum: [REGULAR, BRISK] }
 *       - in: query
 *         name: section
 *         schema: { type: string, example: 'BOOKING_UPDATES' }
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
 *                 unreadByTab: { REGULAR: 2, BRISK: 1 }
 *                 sections:
 *                   - key: ACCOUNT_UPDATES
 *                     title: Account Updates
 *                     tab: REGULAR
 *                     notifications: []
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
 * /notifications/types:
 *   get:
 *     summary: List notification types (for FE filters)
 *     description: |
 *       Returns the catalog of user notification `type` values with labels/categories,
 *       `tab`, `section`, `audience`, plus `count` / `unreadCount` for the logged-in user.
 *       `tabs` = Regular / BRISK with their sections (display order) and the types in each.
 *       Use `type` from each item as `GET /notifications?type=...`.
 *     tags: ['Notifications']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification type filter catalog
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Notification types retrieved successfully.
 *               data:
 *                 types:
 *                   - type: TRADER_PROFILE_APPROVED
 *                     label: Profile approved
 *                     category: account
 *                     description: Trader profile was approved by admin.
 *                     count: 1
 *                     unreadCount: 0
 *                   - type: DOCUMENT_APPROVED
 *                     label: Document approved
 *                     category: documents
 *                     description: A submitted document was approved.
 *                     count: 2
 *                     unreadCount: 1
 */
router.get('/types', controller.listTypes);

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
 *                 byTab: { REGULAR: 2, BRISK: 1 }
 */
router.get('/unread-count', controller.getUnreadCount);

/**
 * @swagger
 * /notifications/devices:
 *   post:
 *     summary: Register this device for push notifications (Customer + Trader apps)
 *     description: |
 *       Call after login / app start and whenever Firebase gives a new FCM token (`onTokenRefresh`).
 *       Safe to call repeatedly — same token is updated, not duplicated. If another user logs in on the
 *       same device, the token moves to the new user.
 *
 *       Every in-app notification (same list as `GET /notifications`) is also sent as a push.
 *       Push `data` contains: `type`, `tab`, `section`, `notificationId` + the notification's own ids
 *       (e.g. `jobId`, `quoteId`) — all values are strings.
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, platform]
 *             properties:
 *               token: { type: string, example: 'fcm-registration-token-from-firebase-messaging', description: FirebaseMessaging getToken() }
 *               platform: { type: string, enum: [IOS, ANDROID], example: ANDROID }
 *     responses:
 *       200:
 *         description: Device registered.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Device registered for push notifications.
 *               data: { device: { token: 'fcm-registration-token-from-firebase-messaging', platform: ANDROID, updatedAt: '2026-10-08T11:00:00.000Z' } }
 *       400: { description: Invalid token or platform. }
 *       401: { description: Unauthorized. }
 */
router.post('/devices', validate(registerDeviceSchema), controller.registerDevice);

/**
 * @swagger
 * /notifications/devices/test:
 *   post:
 *     summary: Send a test push to my registered devices
 *     description: |
 *       Sends "BRISK test notification" to every device registered by the logged-in user
 *       (`data.type = TEST`, not saved in the inbox). Use it to check the app's push setup.
 *       `results[].success = true` means Firebase accepted it — if the phone still shows nothing,
 *       the issue is in the app (permission, foreground handling, notification channel).
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Test sent (see per-device results).
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Test notification sent to 1 of 1 device(s).
 *               data:
 *                 pushEnabled: true
 *                 devicesCount: 1
 *                 sentCount: 1
 *                 results:
 *                   - platform: ANDROID
 *                     tokenPreview: 'e5hXoYSgTAG0…aXM'
 *                     registeredAt: '2026-10-09T04:45:13.391Z'
 *                     success: true
 *                     messageId: 'projects/brisk-trader/messages/0:1791528093113195'
 *                     error: null
 *       401: { description: Unauthorized. }
 */
router.post('/devices/test', controller.testPush);

/**
 * @swagger
 * /notifications/devices/unregister:
 *   post:
 *     summary: Stop push notifications on this device
 *     description: Call on logout **before** clearing the access token (or send `deviceToken` in `POST /auth/logout`).
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string, example: 'fcm-registration-token-from-firebase-messaging' }
 *     responses:
 *       200:
 *         description: Device unregistered (removed=false if it was not registered).
 *         content:
 *           application/json:
 *             example: { success: true, message: Device unregistered from push notifications., data: { removed: true } }
 *       401: { description: Unauthorized. }
 */
router.post('/devices/unregister', validate(unregisterDeviceSchema), controller.unregisterDevice);

/**
 * @swagger
 * /notifications/read-all:
 *   post:
 *     summary: Mark all my notifications as read
 *     description: Optional `tab` marks only that tab (Regular / BRISK). Rows are not removed.
 *     tags: ['Notifications']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tab
 *         schema: { type: string, enum: [REGULAR, BRISK] }
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
router.post('/read-all', validate(notificationReadAllQuerySchema), controller.markAllAsRead);

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
