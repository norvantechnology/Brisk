import fs from 'fs';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Message } from 'firebase-admin/messaging';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

/** FCM accepts at most 500 messages per sendEach call. */
const FCM_BATCH = 500;
const STALE_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);
/** FCM rejects these data keys. */
const RESERVED_DATA_KEY = /^(from|notification|message_type|collapse_key|google\..*|gcm\..*)$/i;

let firebaseApp: App | null | undefined;

const getFirebaseApp = (): App | null => {
  if (firebaseApp !== undefined) return firebaseApp;
  const path = env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!path) {
    logger.warn('[PUSH] FIREBASE_SERVICE_ACCOUNT_PATH not set — push notifications disabled');
    firebaseApp = null;
    return null;
  }
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(path, 'utf8'));
    firebaseApp =
      getApps().find((a) => a.name === 'brisk-push') ??
      initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id }, 'brisk-push');
    logger.info('[PUSH] Firebase initialised', { projectId: serviceAccount.project_id });
  } catch (err) {
    logger.error('[PUSH] Failed to load Firebase service account — push disabled', { path, error: String(err) });
    firebaseApp = null;
  }
  return firebaseApp;
};

export const isPushEnabled = () => getFirebaseApp() !== null;

const toDataPayload = (data: Record<string, unknown>): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || RESERVED_DATA_KEY.test(key)) continue;
    out[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return out;
};

export type PushPayload = {
  title: string;
  body: string;
  /** Sent as FCM `data` (string values) — the app uses it to navigate. */
  data?: Record<string, unknown>;
};

/**
 * Send one push per user (each user can have a different payload, e.g. their own notification id).
 * Never throws; tokens FCM reports as dead are deleted.
 */
export const sendPushToUsers = async (items: Array<{ userId: string; payload: PushPayload }>) => {
  if (!items.length) return;
  const app = getFirebaseApp();
  if (!app) return;

  try {
    const devices = await prisma.deviceToken.findMany({
      where: { userId: { in: [...new Set(items.map((i) => i.userId))] } },
      select: { userId: true, token: true },
    });
    if (!devices.length) return;

    const payloadByUser = new Map(items.map((i) => [i.userId, i.payload]));
    const messages: Message[] = devices.map(({ userId, token }) => {
      const payload = payloadByUser.get(userId)!;
      return {
        token,
        notification: { title: payload.title, body: payload.body },
        data: toDataPayload(payload.data ?? {}),
        android: { priority: 'high', notification: { sound: 'default' } },
        apns: { payload: { aps: { sound: 'default' } } },
      };
    });

    const messaging = getMessaging(app);
    const stale: string[] = [];
    for (let i = 0; i < messages.length; i += FCM_BATCH) {
      const batch = messages.slice(i, i + FCM_BATCH);
      const result = await messaging.sendEach(batch);
      result.responses.forEach((r, idx) => {
        if (r.success) return;
        const code = r.error?.code ?? '';
        const token = (batch[idx] as { token: string }).token;
        const badToken =
          code === 'messaging/invalid-argument' && /registration token/i.test(r.error?.message ?? '');
        if (STALE_TOKEN_CODES.has(code) || badToken) stale.push(token);
        else logger.warn('[PUSH] Send failed', { code, message: r.error?.message });
      });
    }
    if (stale.length) {
      await prisma.deviceToken.deleteMany({ where: { token: { in: stale } } });
    }
  } catch (err) {
    logger.warn('[PUSH] Push dispatch failed', { error: String(err) });
  }
};

/**
 * Send a test push to the caller's own registered devices and report FCM's answer per device
 * (not stored in the inbox). Lets the app verify its push setup end to end.
 */
export const sendTestPush = async (userId: string) => {
  const devices = await prisma.deviceToken.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { token: true, platform: true, updatedAt: true },
  });
  const app = getFirebaseApp();
  if (!app || !devices.length) {
    return { pushEnabled: Boolean(app), devicesCount: devices.length, sentCount: 0, results: [] };
  }

  const sentAt = new Date().toISOString();
  const result = await getMessaging(app).sendEach(
    devices.map(({ token }) => ({
      token,
      notification: { title: 'BRISK test notification', body: 'Push notifications are working on this device.' },
      data: { type: 'TEST', sentAt },
      android: { priority: 'high' as const, notification: { sound: 'default' } },
      apns: { payload: { aps: { sound: 'default' } } },
    }))
  );

  const results = devices.map((d, i) => {
    const r = result.responses[i];
    return {
      platform: d.platform,
      tokenPreview: `${d.token.slice(0, 12)}…${d.token.slice(-6)}`,
      registeredAt: d.updatedAt,
      success: r.success,
      messageId: r.messageId ?? null,
      error: r.success ? null : { code: r.error?.code ?? null, message: r.error?.message ?? null },
    };
  });
  return { pushEnabled: true, devicesCount: devices.length, sentCount: result.successCount, results };
};

export const registerDeviceToken = async (userId: string, token: string, platform: string) =>
  prisma.deviceToken.upsert({
    where: { token },
    create: { userId, token, platform },
    update: { userId, platform },
    select: { token: true, platform: true, updatedAt: true },
  });

export const removeDeviceToken = async (userId: string, token: string) => {
  const { count } = await prisma.deviceToken.deleteMany({ where: { userId, token } });
  return { removed: count > 0 };
};
