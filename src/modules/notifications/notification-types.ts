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
    type: 'TRADER_DOCUMENT_EXPIRY',
    label: 'Document expiry',
    category: 'verification',
    description: 'Trader document expires in 30 / 7 / 1 days, today, or has expired.',
  },
  {
    type: 'SYSTEM',
    label: 'System',
    category: 'system',
    description: 'Platform / system notice.',
  },
];

/** Mobile/web inbox tabs: Regular (activity) and BRISK (company updates). */
export const USER_NOTIFICATION_TABS = ['REGULAR', 'BRISK'] as const;
export type UserNotificationTab = (typeof USER_NOTIFICATION_TABS)[number];

export const USER_NOTIFICATION_TAB_LABELS: Record<UserNotificationTab, string> = {
  REGULAR: 'Regular',
  BRISK: 'BRISK',
};

/** Section headers inside a tab, in display order. */
export const USER_NOTIFICATION_SECTIONS = [
  { key: 'NEW_MATCHING_JOBS', title: 'New Matching Jobs', tab: 'REGULAR' },
  { key: 'QUOTATIONS', title: 'Quotations', tab: 'REGULAR' },
  { key: 'INCOMING_CHATS', title: 'Incoming Chats', tab: 'REGULAR' },
  { key: 'BOOKING_UPDATES', title: 'Booking Updates', tab: 'REGULAR' },
  { key: 'ACCOUNT_UPDATES', title: 'Account Updates', tab: 'REGULAR' },
  { key: 'OTHER', title: 'Other', tab: 'REGULAR' },
  { key: 'COMPANY_UPDATES', title: 'Company Updates', tab: 'BRISK' },
] as const satisfies ReadonlyArray<{ key: string; title: string; tab: UserNotificationTab }>;
export type UserNotificationSection = (typeof USER_NOTIFICATION_SECTIONS)[number]['key'];

export type UserNotificationTypeMeta = NotificationTypeMeta & {
  tab: UserNotificationTab;
  section: UserNotificationSection;
  /** Who receives it. */
  audience: 'TRADER' | 'CUSTOMER' | 'ALL';
};

const userType = (
  type: string,
  label: string,
  section: UserNotificationSection,
  audience: UserNotificationTypeMeta['audience'],
  description: string,
  category = section.toLowerCase()
): UserNotificationTypeMeta => ({
  type,
  label,
  category,
  description,
  section,
  audience,
  tab: section === 'COMPANY_UPDATES' ? 'BRISK' : 'REGULAR',
});

/** Trader Portal / Customer inbox types (`Notification.type`). */
export const USER_NOTIFICATION_TYPE_CATALOG: UserNotificationTypeMeta[] = [
  // Regular › New Matching Jobs
  userType('NEW_MATCHING_JOB', 'New matching job', 'NEW_MATCHING_JOBS', 'TRADER', 'New marketplace job in your category and service area.'),
  // Regular › Quotations
  userType('QUOTE_RECEIVED', 'Quotation received', 'QUOTATIONS', 'CUSTOMER', 'A trader sent, updated or requested your job with a quotation.'),
  userType('QUOTE_ACCEPTED', 'Quotation accepted', 'QUOTATIONS', 'TRADER', 'Customer accepted your quotation — View & Accept to start the job.'),
  userType('QUOTE_SELECTION_CANCELLED', 'Quotation not selected', 'QUOTATIONS', 'TRADER', 'Customer chose another quotation or cancelled the job.'),
  userType('JOB_DECLINED', 'Trader declined', 'QUOTATIONS', 'CUSTOMER', 'Trader declined your acceptance — choose another quotation.'),
  // Regular › Incoming Chats
  userType('NEW_CHAT_MESSAGE', 'New message', 'INCOMING_CHATS', 'ALL', 'New chat message on a job.'),
  // Regular › Booking Updates
  userType('JOB_PUBLISHED', 'Job live', 'BOOKING_UPDATES', 'CUSTOMER', 'Your job was published.'),
  userType('DIRECT_JOB_RECEIVED', 'New booking', 'BOOKING_UPDATES', 'TRADER', 'A customer booked a job directly with you.'),
  userType('JOB_STATUS_CHANGED', 'Job update', 'BOOKING_UPDATES', 'ALL', 'Job confirmed, cancelled or status changed.'),
  userType('SITE_VISIT_REQUESTED', 'Site visit requested', 'BOOKING_UPDATES', 'CUSTOMER', 'Trader proposed site visit date/time.'),
  userType('SITE_VISIT_RESCHEDULED', 'Site visit rescheduled', 'BOOKING_UPDATES', 'CUSTOMER', 'Trader proposed a new site visit date/time.'),
  userType('SITE_VISIT_CONFIRMED', 'Site visit confirmed', 'BOOKING_UPDATES', 'TRADER', 'Customer confirmed your site visit.'),
  userType('SITE_VISIT_RESCHEDULE_REQUESTED', 'Rescheduling request', 'BOOKING_UPDATES', 'TRADER', 'Customer asked for a different site visit time.'),
  userType('PAYMENT_REQUESTED', 'Payment requested', 'BOOKING_UPDATES', 'CUSTOMER', 'Trader requested a payment (full, partial or site visit fee).'),
  userType('PAYMENT_SUCCESSFUL', 'Payment successful', 'BOOKING_UPDATES', 'CUSTOMER', 'Your payment succeeded.'),
  userType('PAYMENT_FAILED', 'Payment failed', 'BOOKING_UPDATES', 'CUSTOMER', 'Your payment failed.'),
  userType('PAYMENT_RECEIVED', 'Payment received', 'BOOKING_UPDATES', 'TRADER', 'Customer paid (job completed & paid, partial or site visit fee).'),
  userType('REFUND_UPDATE', 'Refund update', 'BOOKING_UPDATES', 'CUSTOMER', 'Refund approved, completed or rejected.'),
  // Regular › Account Updates
  userType('TRADER_ONBOARDING_SUBMITTED', 'Application submitted', 'ACCOUNT_UPDATES', 'TRADER', 'Trader onboarding was submitted for admin review.', 'account'),
  userType('TRADER_PROFILE_APPROVED', 'Profile approved', 'ACCOUNT_UPDATES', 'TRADER', 'Trader profile was approved by admin.', 'account'),
  userType('TRADER_PROFILE_REJECTED', 'Profile rejected', 'ACCOUNT_UPDATES', 'TRADER', 'Trader profile / application was rejected.', 'account'),
  userType('DOCUMENT_APPROVED', 'Document approved', 'ACCOUNT_UPDATES', 'TRADER', 'A submitted document was approved.', 'documents'),
  userType('DOCUMENT_REJECTED', 'Document rejected', 'ACCOUNT_UPDATES', 'TRADER', 'A submitted document was rejected.', 'documents'),
  userType('DOCUMENT_STATUS', 'Document update', 'ACCOUNT_UPDATES', 'TRADER', 'Legacy document status update.', 'documents'),
  userType('DOCUMENT_EXPIRY_REMINDER', 'Document expiring', 'ACCOUNT_UPDATES', 'TRADER', 'A document expires in 30 / 7 / 1 days, today, or has expired — upload a renewed copy.', 'documents'),
  // BRISK › Company Updates (sent by admin)
  userType('PLATFORM_UPDATE', 'Platform update', 'COMPANY_UPDATES', 'ALL', 'New feature / platform announcement.', 'system'),
  userType('POLICY_CHANGE', 'Policy change', 'COMPANY_UPDATES', 'ALL', 'Terms / policy update.', 'system'),
  userType('SYSTEM_MESSAGE', 'System message', 'COMPANY_UPDATES', 'ALL', 'Maintenance / system notice.', 'system'),
  userType('SYSTEM', 'System', 'COMPANY_UPDATES', 'ALL', 'Platform / system notice (legacy).', 'system'),
];

const USER_TYPE_META = new Map(USER_NOTIFICATION_TYPE_CATALOG.map((t) => [t.type, t]));

/** Unknown / future types land in Regular › Other so nothing is hidden. */
export const userNotificationMeta = (type: string) => {
  const meta = USER_TYPE_META.get(type);
  const section: UserNotificationSection = meta?.section ?? 'OTHER';
  return {
    tab: meta?.tab ?? ('REGULAR' as UserNotificationTab),
    section,
    sectionTitle: USER_NOTIFICATION_SECTIONS.find((s) => s.key === section)!.title,
  };
};

export const BRISK_TAB_TYPES = USER_NOTIFICATION_TYPE_CATALOG.filter((t) => t.tab === 'BRISK').map(
  (t) => t.type
);

export const COMPANY_UPDATE_TYPES = ['PLATFORM_UPDATE', 'POLICY_CHANGE', 'SYSTEM_MESSAGE'] as const;
