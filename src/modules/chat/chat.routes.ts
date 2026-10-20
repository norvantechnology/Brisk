import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './chat.controller';
import {
  chatListQuerySchema,
  chatMessagesQuerySchema,
  chatSendBodySchema,
} from './chat.validation';

const router = Router();
const chatUsers = [authMiddleware, roleMiddleware(['CUSTOMER', 'TRADER'] as const)];

/**
 * @swagger
 * /chats:
 *   get:
 *     summary: Messages inbox — conversations list
 *     tags: ['Chat / Messages']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Customer + Trader Messages tab.
 *       Each conversation is a **job** (`conversationId` = `jobId`).
 *       Sorted by latest message. Only jobs that already have chat messages.
 *
 *       **Unread badge:** use `unreadCount` (not `messagesCount`).
 *       `unreadCount` = messages from the counterpart with `readAt=null` (your own messages never count).
 *       Opening `GET /chats/{jobId}/messages` marks those as read → badge goes to 0.
 *       `meta.totalUnreadCount` = sum across all conversations (tab badge).
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Job title / ref / counterpart name
 *     responses:
 *       200:
 *         description: Conversation cards
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Conversations retrieved successfully.
 *               data:
 *                 - conversationId: eff29752-f5a2-4694-b369-0b4f2df3f210
 *                   jobId: eff29752-f5a2-4694-b369-0b4f2df3f210
 *                   jobRef: JOB-1EA2
 *                   title: Boiler Service
 *                   jobStatus: SCHEDULED
 *                   counterpart:
 *                     id: user-uuid
 *                     traderId: trader-uuid
 *                     name: Brisk Trader
 *                     profilePhotoUrl: null
 *                     role: TRADER
 *                   lastMessage:
 *                     id: msg-uuid
 *                     message: On my way
 *                     sentAt: '2026-10-19T10:00:00.000Z'
 *                     isMine: false
 *                   messagesCount: 4
 *                   unreadCount: 2
 *               meta: { total: 1, page: 1, limit: 20, totalPages: 1, totalUnreadCount: 2 }
 */
router.get('/', ...chatUsers, validate(chatListQuerySchema), controller.listConversations);

/**
 * @swagger
 * /chats/{jobId}/messages:
 *   get:
 *     summary: Chat thread for a job
 *     tags: ['Chat / Messages']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Open thread using `conversationId` / `jobId` from inbox or job detail.
 *       Oldest → newest. `isMine` marks the current user's messages.
 *       Each item includes `imageUrl` (URL or `null`) and `readAt` (ISO or `null`).
 *       **Read receipts:** calling this GET marks all unread messages from the counterpart
 *       as read (`readAt` = now). FE: `isMine` + `readAt=null` → single tick; `readAt` set → blue double tick.
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 100 }
 *     responses:
 *       200:
 *         description: Thread + messages
 *   post:
 *     summary: Send a chat message
 *     tags: ['Chat / Messages']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Body: text and/or image (at least one required).
 *       Upload image first: `POST /uploads` with `purpose=chat_photo` → use returned `url` as `imageUrl`.
 *       Example: `{ "message": "Hello", "imageUrl": "https://api.brisk.ie/uploads/files/chat_photo/..." }`
 *       Recipient gets push `NEW_CHAT_MESSAGE` with `jobId`.
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message: { type: string, example: Hello, here is the photo }
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *                 example: https://api.brisk.ie/uploads/files/chat_photo/example.jpg
 *     responses:
 *       201:
 *         description: Message created (`imageUrl` null when text-only)
 *       400:
 *         description: No counterpart / missing message and imageUrl
 *       404:
 *         description: Conversation not found
 */
router.get(
  '/:jobId/messages',
  ...chatUsers,
  validate(chatMessagesQuerySchema),
  controller.listMessages
);
router.post(
  '/:jobId/messages',
  ...chatUsers,
  validate(chatSendBodySchema),
  controller.sendMessage
);

export default router;
