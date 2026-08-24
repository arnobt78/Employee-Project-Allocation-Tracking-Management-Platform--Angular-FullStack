import * as Sentry from '@sentry/angular';
import { environment } from '../../../environments/environment';
import { SENTRY_TUNNEL_ROUTE } from './constants';
import { SENTRY_IGNORE_ERRORS, sentryBeforeSend } from './filters';

/**
 * Initialize browser Sentry before Angular bootstrap.
 * Empty DSN = disabled. Events go through same-origin tunnel.
 */
export function initClientSentry(): void {
  const dsn =
    typeof environment.sentryDsn === 'string' ? environment.sentryDsn.trim() : '';

  Sentry.init({
    dsn: dsn || undefined,
    enabled: Boolean(dsn),
    tunnel: SENTRY_TUNNEL_ROUTE,
    environment: environment.production ? 'production' : 'development',
    tracesSampleRate: environment.production ? 0.1 : 0,
    ignoreErrors: SENTRY_IGNORE_ERRORS,
    beforeSend: sentryBeforeSend,
    debug: false,
  });
}

export { Sentry };
