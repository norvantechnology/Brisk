import { Router } from 'express';
import { sendResponse } from '../utils/apiResponse';
import { RealtimeEvents } from './events';

const router = Router();

/**
 * @swagger
 * /realtime:
 *   get:
 *     summary: Realtime (Socket.IO) connection guide for mobile
 *     tags: ['Realtime']
 *     description: |
 *       **Existing REST job/payment APIs are unchanged.** Socket.IO is additive —
 *       listen for live events so the app updates without pull-to-refresh.
 *
 *       **Connect (same host as REST):**
 *       - URL: `http://<host>:3000` (path `/socket.io`)
 *       - Auth: `auth: { token: "<accessToken>" }` **or** header `Authorization: Bearer <accessToken>`
 *       - Same customer/trader JWT as REST (`type=user_access`)
 *
 *       **Auto-joined room:** `user:{userId}`
 *
 *       **Client → server:**
 *       - `job:subscribe` `{ "jobId": "..." }` (owner or assigned trader)
 *       - `job:unsubscribe` `{ "jobId": "..." }`
 *       - `booking:subscribe` `{ "bookingId": "..." }`
 *
 *       **Server → client events:** see `data.events` in this response.
 *     responses:
 *       200:
 *         description: Connection contract for mobile Socket.IO client.
 */
router.get('/', (_req, res) => {
  sendResponse({
    res,
    statusCode: 200,
    message: 'Realtime Socket.IO contract.',
    data: {
      transport: 'socket.io',
      path: '/socket.io',
      auth: {
        preferred: 'handshake.auth.token = accessToken',
        alternate: 'Authorization: Bearer <accessToken>',
        queryFallback: '?token=<accessToken>',
      },
      rooms: {
        autoJoin: 'user:{userId}',
        job: 'job:{jobId} via job:subscribe',
        booking: 'booking:{bookingId} via booking:subscribe',
      },
      clientEmits: ['job:subscribe', 'job:unsubscribe', 'booking:subscribe'],
      serverEmits: Object.values(RealtimeEvents),
      notes: [
        'REST APIs under /jobs and /payments are unchanged.',
        'On event, patch local state or soft-refresh GET /jobs/{id} / GET /invoices/{id}.',
        'After login, connect socket; on logout, disconnect.',
      ],
    },
  });
});

export default router;
