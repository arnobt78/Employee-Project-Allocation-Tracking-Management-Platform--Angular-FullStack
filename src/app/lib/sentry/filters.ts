/**
 * Noise filters for Sentry — keep in sync with api/_lib/sentry/filters.mjs
 */

export const SENTRY_IGNORE_ERRORS: Array<string | RegExp> = [
  'ResizeObserver loop limit exceeded',
  'ResizeObserver loop completed with undelivered notifications.',
  'Non-Error promise rejection captured',
  'Script error.',
  /Loading chunk [\d]+ failed/,
  'top.GLOBALS',
  'AbortError',
  'NetworkError when attempting to fetch resource.',
  'Failed to fetch',
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

function isThirdPartyNoise(text: string): boolean {
  return THIRD_PARTY_PATTERNS.some((p) => p.test(text));
}

export function sentryBeforeSend<T extends { exception?: unknown; message?: unknown }>(
  event: T
): T | null {
  try {
    const text = JSON.stringify(event.exception ?? event.message ?? '');
    if (isThirdPartyNoise(text)) {
      return null;
    }
  } catch {
    /* keep event */
  }
  return event;
}
