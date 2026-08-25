/**
 * Quiet post-build Sentry source map upload for Angular.
 * Skips when SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN are missing.
 * Always deletes *.map under dist so maps are not served publicly.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, rmSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
loadDotenv({ path: join(root, ".env") });
const distDir = join(root, "dist");

function trim(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "";
}

function collectMaps(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      collectMaps(full, out);
    } else if (name.endsWith(".map")) {
      out.push(full);
    }
  }
  return out;
}

function deleteMaps() {
  const maps = collectMaps(distDir);
  for (const file of maps) {
    try {
      rmSync(file, { force: true });
    } catch {
      /* ignore */
    }
  }
  return maps.length;
}

const org = trim(process.env.SENTRY_ORG);
const project = trim(process.env.SENTRY_PROJECT);
const authToken = trim(process.env.SENTRY_AUTH_TOKEN);
const canUpload = Boolean(org && project && authToken);

if (!canUpload) {
  const removed = deleteMaps();
  if (removed > 0) {
    console.log(
      `[sentry] Skipped upload (missing org/project/token); removed ${removed} source map(s).`
    );
  }
  process.exit(0);
}

const cli = join(root, "node_modules", "@sentry", "cli", "bin", "sentry-cli");
const result = spawnSync(
  cli,
  [
    "sourcemaps",
    "upload",
    "--org",
    org,
    "--project",
    project,
    "--release",
    trim(process.env.SENTRY_RELEASE) ||
      trim(process.env.VERCEL_GIT_COMMIT_SHA) ||
      "employee-management",
    "--quiet",
    distDir,
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      SENTRY_AUTH_TOKEN: authToken,
      SENTRY_LOG_LEVEL: "error",
      SENTRY_TELEMETRY: "0",
    },
    encoding: "utf8",
  }
);

if (result.status !== 0) {
  // Do not fail the Vercel build over upload noise — maps still get deleted.
  console.warn(
    "[sentry] Source map upload failed (build continues):",
    (result.stderr || result.stdout || "").trim() || `exit ${result.status}`
  );
} else {
  console.log("[sentry] Source maps uploaded (quiet).");
}

const removed = deleteMaps();
console.log(`[sentry] Removed ${removed} source map(s) from dist.`);
process.exit(0);
