export const NOTIFICATION_LOG_RETENTION_DAYS = 90;

/** MongoDB TTL index on NotificationLog; Prisma cannot declare TTL indexes. */
export const NOTIFICATION_LOG_TTL_INDEX = {
  key: { createdAt: 1 },
  options: {
    name: "NotificationLog_createdAt_ttl",
    expireAfterSeconds: NOTIFICATION_LOG_RETENTION_DAYS * 24 * 60 * 60,
  },
};
