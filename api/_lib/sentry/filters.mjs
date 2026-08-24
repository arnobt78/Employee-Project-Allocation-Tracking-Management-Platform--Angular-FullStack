/**
 * Noise filters for Sentry — ignore extensions / benign browser quirks.
 * Keep in sync with src/app/lib/sentry/filters.ts
 */

export const SENTRY_IGNORE_ERRORS = [
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications.",
  "Non-Error promise rejection captured",
  "Script error.",
  /Loading chunk [\d]+ failed/,
  "top.GLOBALS",
  "AbortError",
  "NetworkError when attempting to fetch resource.",
  "Failed to fetch",
];

const THIRD_PARTY_PATTERNS = [
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /safari-extension:\/\//i,
  /webkit-masked-url:\/\//i,
  /grammarly/i,
  /googletranslate/i,
  /metamask/i,
  /kaspersky/i,
];

function isThirdPartyNoise(text) {
  return THIRD_PARTY_PATTERNS.some((p) => p.test(text));
}

/**
 * @param {import('@sentry/core').ErrorEvent} event
 * @returns {import('@sentry/core').ErrorEvent | null}
 */
export function sentryBeforeSend(event) {
  try {
    const text = JSON.stringify(event.exception ?? event.message ?? "");
    if (isThirdPartyNoise(text)) {
      return null;
    }
  } catch {
    /* keep event */
  }
  return event;
}
