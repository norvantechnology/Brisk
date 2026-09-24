/**
 * Canonical in-app actionUrl builders for notifications.
 * Frontend should navigate with `router.push(actionUrl)` — no per-type routing.
 *
 * Admin Portal paths (leading slash, Trader.id — not userId):
 *   /traders/{traderId}
 *   (document verification is a modal on the trader details page — do not use /trader-verification/…)
 *
 * Trader Portal paths:
 *   /dashboard
 *   /documents
 *   /onboarding/pending-review
 */

export const adminNotificationActionUrl = {
  traderDetail: (traderId: string) => `/traders/${traderId}`,
  /** @deprecated FE has no trader-verification route — use traderDetail (modal on details). */
  traderVerificationDetail: (traderId: string) => `/traders/${traderId}`,
} as const;

export const traderNotificationActionUrl = {
  dashboard: () => '/dashboard',
  documents: () => '/documents',
  documentDetail: (documentId: string) => `/documents/${documentId}`,
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

/** Rewrite legacy /trader-verification/{id} → /traders/{id} (FE uses modal on details). */
const normalizeAdminActionUrl = (url: string): string => {
  const withSlash = url.startsWith('/') ? url : `/${url}`;
  const legacy = withSlash.match(/^\/trader-verification\/([^/?#]+)\/?$/i);
  if (legacy?.[1]) {
    return adminNotificationActionUrl.traderDetail(legacy[1]);
  }
  return withSlash;
};

/** True when URL already targets a specific entity (has a path segment after the resource). */
const isDetailPath = (url: string): boolean => {
  const parts = url.replace(/\/+$/, '').split('/').filter(Boolean);
  // e.g. traders/{id} → 2+ segments
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
    return normalizeAdminActionUrl(stored);
  }

  switch (type) {
    case 'TRADER_OTP_VERIFIED':
    case 'TRADER_PENDING_APPROVAL':
    case 'TRADER_DOCUMENT_UPLOADED':
      if (traderId) return adminNotificationActionUrl.traderDetail(traderId);
      break;
    default:
      break;
  }

  if (stored) {
    return normalizeAdminActionUrl(stored);
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
    case 'DOCUMENT_APPROVED':
    case 'DOCUMENT_REJECTED':
    case 'DOCUMENT_STATUS': {
      const documentId = str(data.documentId);
      if (documentId) return traderNotificationActionUrl.documentDetail(documentId);
      return traderNotificationActionUrl.documents();
    }
    default:
      return null;
  }
};
