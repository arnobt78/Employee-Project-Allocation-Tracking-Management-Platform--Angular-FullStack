import { prisma } from "../_lib/prisma-client.mjs";
import { captureApiException } from "../_lib/sentry/server.mjs";

const MAX_ERROR_LENGTH = 300;
const EMAIL_PATTERN = /[^\s<>"'():;,]+@[^\s<>"'():;,]+/g;

/** Provider errors can echo recipients; store only a redacted, bounded summary. */
function sanitizeError(error) {
  return String(error?.message ?? error)
    .replace(EMAIL_PATTERN, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ERROR_LENGTH);
}
const MAX_LIMIT = 100;

const ENTITY_KEYS = [
  ["assignmentId", "assignment"],
  ["projectId", "project"],
  ["employeeId", "employee"],
];

function countRecipients(...lists) {
  return lists
    .flatMap((list) => (Array.isArray(list) ? list : list ? [list] : []))
    .filter(Boolean).length;
}

function entityFrom(metadata) {
  for (const [key, entityType] of ENTITY_KEYS) {
    const id = Number(metadata?.[key]);
    if (Number.isFinite(id) && id > 0) {
      return { entityType, entityId: id };
    }
  }
  return { entityType: null, entityId: null };
}

/**
 * Persists one delivery outcome. Never throws: logging must not affect the
 * notification flow. Failures are also reported to Sentry.
 */
export async function recordDelivery({ metadata, to, cc, bcc, status, provider = null, error = null }) {
  const event = String(metadata?.action ?? "notification");
  const message = error ? sanitizeError(error) : null;

  if (status === "failed") {
    captureApiException(new Error(`Email delivery failed: ${event}`), {
      area: "notification",
      event,
    });
  }

  try {
    await prisma.notificationLog.create({
      data: {
        event,
        ...entityFrom(metadata),
        status,
        provider,
        recipientCount: countRecipients(to, cc, bcc),
        error: message,
      },
    });
  } catch (logError) {
    console.error("[Notification] Failed to record delivery", {
      event,
      error: logError?.message,
    });
  }
}

function clampLimit(value, fallback) {
  const limit = Number(value);
  return Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), MAX_LIMIT) : fallback;
}

const LOG_SELECT = {
  id: true,
  event: true,
  entityType: true,
  entityId: true,
  status: true,
  provider: true,
  recipientCount: true,
  error: true,
  createdAt: true,
};

export function listNotificationLog(limit) {
  return prisma.notificationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: clampLimit(limit, 20),
    select: LOG_SELECT,
  });
}

/** Failed deliveries strictly after `since` (ISO string); defaults to the last 5 minutes. */
export function listNotificationFailures(since) {
  const parsed = since ? new Date(since) : null;
  const after =
    parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(Date.now() - 5 * 60_000);
  return prisma.notificationLog.findMany({
    where: { status: "failed", createdAt: { gt: after } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: LOG_SELECT,
  });
}
