/**
 * Same-origin Sentry tunnel — bypasses ad blockers.
 * POST /api/monitoring → forward envelope to Sentry ingest (DSN allowlist).
 */
import { handleSentryTunnel } from "./_lib/sentry/tunnel.mjs";

export default async function handler(request, response) {
  return handleSentryTunnel(request, response);
}
