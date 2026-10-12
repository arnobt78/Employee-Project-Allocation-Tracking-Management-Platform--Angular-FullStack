#!/usr/bin/env node
/**
 * Wipes every domain collection, reseeds the demo dataset and keeps exactly one
 * login: admin / 112233 (bcrypt). All sessions are revoked. Ensures the
 * NotificationLog TTL index (see ensure-indexes.mjs).
 *
 * Guards: ALLOW_DB_WIPE=1 always; EH_ALLOW_REMOTE_WIPE=1 when DATABASE_URL is not localhost.
 * Usage: ALLOW_DB_WIPE=1 npm run db:reset:demo
 */
import "dotenv/config";
import { MongoClient } from "mongodb";
import { prisma } from "../api/_lib/prisma-client.mjs";
import { seedDemoData } from "../prisma/seed.ts";
import { DEMO_USERNAME, upsertDemoUser } from "./seed-demo-user.mjs";
import { ensureNotificationLogTtl, NOTIFICATION_LOG_RETENTION_DAYS } from "./ensure-indexes.mjs";

const DOMAIN_COLLECTIONS = [
  "Counter",
  "DepartmentParent",
  "DepartmentChild",
  "Employee",
  "Project",
  "ProjectEmployee",
  "Session",
  "NotificationLog",
];

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);

/** Host list and database name only; credentials are never printed. Multi-host URLs are not valid `URL`s. */
function describeTarget(connectionUrl) {
  const match = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/.exec(connectionUrl);
  if (!match) {
    fail("DATABASE_URL is not a mongodb:// or mongodb+srv:// URL.");
  }
  const hosts = match[1].split(",").map((host) => host.replace(/:\d+$/, "").toLowerCase());
  return {
    host: match[1],
    database: match[2] || "(default)",
    isLocal: hosts.every((host) => LOCAL_HOSTS.has(host)),
  };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (process.env.ALLOW_DB_WIPE !== "1") {
    fail("Refusing to wipe: set ALLOW_DB_WIPE=1.");
  }
  if (!url) {
    fail("DATABASE_URL is not set.");
  }
  const target = describeTarget(url);
  console.log(`Target: host=${target.host} database=${target.database}`);
  if (!target.isLocal && process.env.EH_ALLOW_REMOTE_WIPE !== "1") {
    fail("Refusing to wipe a non-local database: also set EH_ALLOW_REMOTE_WIPE=1.");
  }

  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db();
    for (const name of DOMAIN_COLLECTIONS) {
      const { deletedCount } = await db.collection(name).deleteMany({});
      console.log(`Cleared ${name}: ${deletedCount}`);
    }
    const { deletedCount: removedUsers } = await db
      .collection("AppUser")
      .deleteMany({ username: { $ne: DEMO_USERNAME } });
    console.log(`Removed other AppUsers: ${removedUsers}`);

    await seedDemoData(db);
    const ttl = await ensureNotificationLogTtl(db);
    console.log(`NotificationLog TTL (${NOTIFICATION_LOG_RETENTION_DAYS} days): ${ttl}`);
  } finally {
    await client.close();
  }

  const admin = await upsertDemoUser();
  console.log(`Login ready: ${admin.username} (sessions revoked)`);
}

main()
  .catch((error) => {
    console.error("Reset failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
