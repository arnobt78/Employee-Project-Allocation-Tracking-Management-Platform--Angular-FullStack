const runtimeEnv =
  (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  )?.process?.env ?? {};

const fromEnv = (key: string, fallback: string) => {
  const value = runtimeEnv[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : fallback;
};

// Browser bundle: only public runtime config. DB keys, AI keys, email tokens live in Vercel/server env (see api/employee-management).
// Sentry DSN is public by design; empty = disabled. Production value is baked in environment.prod.ts at build.
export const environment = {
  production: false,
  appBaseUrl: fromEnv('APP_BASE_URL', 'http://localhost:4200'),
  sentryDsn: fromEnv(
    'SENTRY_DSN',
    fromEnv('NG_APP_SENTRY_DSN', fromEnv('NEXT_PUBLIC_SENTRY_DSN', ''))
  ),
  demoLogin: {
    username: 'admin',
    password: '112233',
  },
  api: {
    baseUrl: fromEnv('NG_APP_API_BASE_URL', '/api/employee-management/'),
  },
  featureToggles: {
    readinessChecklistV2:
      fromEnv('NG_APP_FEATURE_READINESS_V2', 'true') === 'true',
    aiSummaryGenerator:
      fromEnv('NG_APP_FEATURE_AI_SUMMARY', 'false') === 'true',
    workflowTimeline:
      fromEnv('NG_APP_FEATURE_WORKFLOW_TIMELINE', 'false') === 'true',
  },
};
