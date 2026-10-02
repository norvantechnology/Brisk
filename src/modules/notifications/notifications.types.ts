export type NotificationListFilters = {
  page?: string;
  limit?: string;
  /** When true, only unread rows. */
  unreadOnly?: boolean | string;
  type?: string;
  search?: string;
  /** REGULAR | BRISK */
  tab?: string;
  /** e.g. NEW_MATCHING_JOBS, INCOMING_CHATS, BOOKING_UPDATES, COMPANY_UPDATES */
  section?: string;
};
