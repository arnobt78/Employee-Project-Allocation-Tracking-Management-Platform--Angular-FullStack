import * as Sentry from "@sentry/node";
import { getServerSentryDsn, getTracesSampleRate } from "./env.mjs";
import { SENTRY_IGNORE_ERRORS, sentryBeforeSend } from "./filters.mjs";

let initialized = false;

export function initServerSentry() {
  if (initialized) {
    return;
  }
  initialized = true;

  const dsn = getServerSentryDsn();
  Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    tracesSampleRate: getTracesSampleRate(),
    ignoreErrors: SENTRY_IGNORE_ERRORS,
    beforeSend: sentryBeforeSend,
    debug: false,
  });
}

/**
 * @param {unknown} error
 * @param {Record<string, string>} [tags]
 */
export function captureApiException(error, tags) {
  initServerSentry();
  if (!getServerSentryDsn()) {
    return;
  }
  Sentry.captureException(error, tags ? { tags } : undefined);
}
