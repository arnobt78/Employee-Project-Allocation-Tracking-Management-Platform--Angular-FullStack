const fs = require("fs");
const path = require("path");

try {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
} catch {
  /* dotenv optional outside local */
}

const envProdPath = path.resolve(
  __dirname,
  "../src/environments/environment.prod.ts"
);

function trimEnv(key) {
  const value = process.env[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "";
}

// Public DSN only — never embed SENTRY_AUTH_TOKEN
const sentryDsn =
  trimEnv("SENTRY_DSN") ||
  trimEnv("NG_APP_SENTRY_DSN") ||
  trimEnv("NEXT_PUBLIC_SENTRY_DSN");

const sentryDsnLiteral = JSON.stringify(sentryDsn);

// Generated at postinstall / build — mirrors environment.ts; server-only secrets are not embedded.
const content = `const runtimeEnv =
  (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  )?.process?.env ?? {};

const fromEnv = (key: string, fallback: string) => {
  const value = runtimeEnv[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
};

export const environment = {
  production: true,
  appBaseUrl: fromEnv(
    'APP_BASE_URL',
    'https://employee-project-management.vercel.app'
  ),
  // Baked at build time from SENTRY_DSN (public). Empty = Sentry disabled.
  sentryDsn: ${sentryDsnLiteral},
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
`;

fs.writeFileSync(envProdPath, content, { encoding: "utf8" });
console.log("✅ Generated environment.prod.ts");
