export type NotificationListFilters = {
  page?: string;
  limit?: string;
  /** When true, only unread rows. */
  unreadOnly?: boolean | string;
  type?: string;
  search?: string;
};
