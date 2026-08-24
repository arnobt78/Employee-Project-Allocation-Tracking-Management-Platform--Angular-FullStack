function trimEnv(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

/**
 * Resolve public client DSN from env aliases.
 * Primary: SENTRY_DSN; aliases: NG_APP_SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN
 */
export function getClientSentryDsn() {
  return (
    trimEnv(process.env.SENTRY_DSN) ||
    trimEnv(process.env.NG_APP_SENTRY_DSN) ||
    trimEnv(process.env.NEXT_PUBLIC_SENTRY_DSN) ||
    undefined
  );
}

/** Server DSN — falls back to client DSN aliases. */
export function getServerSentryDsn() {
  return getClientSentryDsn();
}

/** Tunnel allowlist — only forward envelopes for these DSNs (SSRF-safe). */
export function getAllowedSentryDsns() {
  return [
    ...new Set(
      [
        trimEnv(process.env.SENTRY_DSN),
        trimEnv(process.env.NG_APP_SENTRY_DSN),
        trimEnv(process.env.NEXT_PUBLIC_SENTRY_DSN),
      ].filter((v) => Boolean(v))
    ),
  ];
}

export function getTracesSampleRate() {
  return process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
    ? 0.1
    : 0;
}
