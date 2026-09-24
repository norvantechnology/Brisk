/**
 * Canonical notification type catalogs for Admin + Trader/Customer inboxes.
 * FE uses these for filter chips; list APIs already accept `?type=...`.
 */

export type NotificationTypeMeta = {
  type: string;
  label: string;
  /** UI grouping for filter chips */
  category: string;
  description: string;
};

/** Admin Portal inbox types (`AdminNotification.type`). */
export const ADMIN_NOTIFICATION_TYPE_CATALOG: NotificationTypeMeta[] = [
  {
    type: 'TRADER_OTP_VERIFIED',
    label: 'OTP verified',
    category: 'traders',
    description: 'Trader verified email and mobile OTP.',
  },
  {
    type: 'TRADER_PENDING_APPROVAL',
    label: 'Pending approval',
    category: 'verification',
    description: 'Trader submitted onboarding and awaits verification.',
  },
  {
    type: 'TRADER_DOCUMENT_UPLOADED',
    label: 'Document uploaded',
    category: 'verification',
    description: 'Trader uploaded or replaced a verification document.',
  },
  {
    type: 'SYSTEM',
    label: 'System',
    category: 'system',
    description: 'Platform / system notice.',
  },
];

/** Trader Portal / Customer inbox types (`Notification.type`). */
export const USER_NOTIFICATION_TYPE_CATALOG: NotificationTypeMeta[] = [
  {
    type: 'TRADER_PROFILE_APPROVED',
    label: 'Profile approved',
    category: 'account',
    description: 'Trader profile was approved by admin.',
  },
  {
    type: 'TRADER_PROFILE_REJECTED',
    label: 'Profile rejected',
    category: 'account',
    description: 'Trader profile / application was rejected.',
  },
  {
    type: 'DOCUMENT_APPROVED',
    label: 'Document approved',
    category: 'documents',
    description: 'A submitted document was approved.',
  },
  {
    type: 'DOCUMENT_REJECTED',
    label: 'Document rejected',
    category: 'documents',
    description: 'A submitted document was rejected.',
  },
  {
    type: 'DOCUMENT_STATUS',
    label: 'Document update',
    category: 'documents',
    description: 'Legacy document status update.',
  },
  {
    type: 'SYSTEM',
    label: 'System',
    category: 'system',
    description: 'Platform / system notice.',
  },
];
