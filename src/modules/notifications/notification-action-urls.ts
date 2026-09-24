/**
 * Canonical in-app actionUrl builders for notifications.
 * Frontend should navigate with `router.push(actionUrl)` — no per-type routing.
 *
 * Admin Portal paths (leading slash, Trader.id — not userId):
 *   /traders/{traderId}
 *   /trader-verification/{traderId}
 *
 * Trader Portal paths:
 *   /dashboard
 *   /documents
 *   /onboarding/pending-review
 */

export const adminNotificationActionUrl = {
  traderDetail: (traderId: string) => `/traders/${traderId}`,
  traderVerificationDetail: (traderId: string) => `/trader-verification/${traderId}`,
} as const;

export const traderNotificationActionUrl = {
  dashboard: () => '/dashboard',
  documents: () => '/documents',
  onboardingPendingReview: () => '/onboarding/pending-review',
} as const;

const asRecord = (payload: unknown): Record<string, unknown> => {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
};

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

/** True when URL already targets a specific entity (has a path segment after the resource). */
const isDetailPath = (url: string): boolean => {
  const parts = url.replace(/\/+$/, '').split('/').filter(Boolean);
  // e.g. traders/{id} → 2+ segments; trader-verification/{id} → 2+
  return parts.length >= 2;
};

/**
 * Resolve the best actionUrl for an admin notification.
 * Prefer stored detail URL; otherwise derive from type + payload.traderId.
 */
export const resolveAdminNotificationActionUrl = (
  type: string,
  actionUrl: string | null | undefined,
  payload: unknown
): string | null => {
  const data = asRecord(payload);
  const traderId = str(data.traderId);
  const stored = str(actionUrl);

  if (stored && isDetailPath(stored)) {
    return stored.startsWith('/') ? stored : `/${stored}`;
  }

  switch (type) {
    case 'TRADER_OTP_VERIFIED':
      if (traderId) return adminNotificationActionUrl.traderDetail(traderId);
      break;
    case 'TRADER_PENDING_APPROVAL':
      if (traderId) return adminNotificationActionUrl.traderVerificationDetail(traderId);
      break;
    default:
      break;
  }

  if (stored) {
    return stored.startsWith('/') ? stored : `/${stored}`;
  }
  return null;
};

/**
 * Resolve actionUrl for trader/customer user notifications (payload-based).
 */
export const resolveUserNotificationActionUrl = (
  type: string,
  payload: unknown
): string | null => {
  const data = asRecord(payload);
  const stored = str(data.actionUrl) || str(data.url);
  if (stored) {
    return stored.startsWith('/') ? stored : `/${stored}`;
  }

  switch (type) {
    case 'TRADER_PROFILE_APPROVED':
      return traderNotificationActionUrl.dashboard();
    case 'TRADER_PROFILE_REJECTED':
      return traderNotificationActionUrl.onboardingPendingReview();
    default:
      return null;
  }
};
