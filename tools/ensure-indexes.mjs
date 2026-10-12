#!/usr/bin/env node
/**
 * Indexes Prisma cannot declare for MongoDB. Idempotent. `prisma db push` drops
 * them, so `npm run db:push` runs this afterwards (the API also recreates the
 * TTL index once per instance).
 *
 * - NotificationLog: TTL on `createdAt` so delivery records expire after 90 days.
 *
 * Usage: npm run db:indexes
 */
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { MongoClient } from "mongodb";
import {
  NOTIFICATION_LOG_RETENTION_DAYS,
  NOTIFICATION_LOG_TTL_INDEX,
} from "../api/_lib/notification-log-retention.mjs";

export { NOTIFICATION_LOG_RETENTION_DAYS };

function isAscendingCreatedAt(key) {
  const fields = Object.keys(key ?? {});
  return fields.length === 1 && key.createdAt === 1;
}

/**
 * MongoDB rejects two indexes on the same key with different options, so any
 * other `{ createdAt: 1 }` index is replaced by the TTL one.
 * Resolves `"unchanged"` or `"created"`.
 */
export async function ensureNotificationLogTtl(db) {
  const collection = db.collection("NotificationLog");
  const { key, options } = NOTIFICATION_LOG_TTL_INDEX;
  let indexes = [];
  try {
    indexes = await collection.indexes();
  } catch (error) {
    if (error?.codeName !== "NamespaceNotFound") {
      throw error;
    }
  }

  for (const index of indexes.filter((entry) => isAscendingCreatedAt(entry.key))) {
    if (index.name === options.name && index.expireAfterSeconds === options.expireAfterSeconds) {
      return "unchanged";
    }
    await collection.dropIndex(index.name);
  }
  await collection.createIndex(key, options);
  return "created";
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }
  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db();
    const result = await ensureNotificationLogTtl(db);
    console.log(
      `${db.databaseName}: NotificationLog TTL (${NOTIFICATION_LOG_RETENTION_DAYS} days) ${result}`
    );
  } finally {
    await client.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error("Ensuring indexes failed:", error?.message ?? error);
    process.exitCode = 1;
  });
}
