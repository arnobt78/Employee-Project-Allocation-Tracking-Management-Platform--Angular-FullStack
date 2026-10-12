/**
 * Seeds the demo dataset from `prisma/seed-data.ts`.
 *
 * Usage: npm run db:seed (upserts by business id, safe to re-run).
 * For a clean database use `npm run db:reset:demo`, which wipes first.
 *
 * Writes go through the native driver so every document gets an ObjectId `_id`
 * and integer ids are stored as Int32, matching what Prisma reads and deletes.
 */

import { pathToFileURL } from "node:url";
import { MongoClient, type Db } from "mongodb";
import "dotenv/config";
import {
  ASSIGNMENTS,
  COUNTERS,
  DEPARTMENT_CHILDREN,
  DEPARTMENT_PARENTS,
  EMPLOYEES,
  PROJECTS,
} from "./seed-data";

async function upsertAll<T extends Record<string, unknown>>(
  db: Db,
  collection: string,
  key: keyof T & string,
  rows: readonly T[]
): Promise<number> {
  const now = new Date();
  const result = await db.collection(collection).bulkWrite(
    rows.map((row) => ({
      updateOne: {
        filter: { [key]: row[key] },
        update: { $set: { ...row, updatedAt: now }, $setOnInsert: { createdAt: now } },
        upsert: true,
      },
    }))
  );
  return result.upsertedCount + result.modifiedCount;
}

/** `$max` never rewinds a counter, so re-seeding a database with newer records cannot reissue ids. */
async function raiseCounters(db: Db): Promise<number> {
  const now = new Date();
  const result = await db.collection("Counter").bulkWrite(
    Object.entries(COUNTERS).map(([key, value]) => ({
      updateOne: {
        filter: { key },
        update: { $max: { value }, $set: { updatedAt: now }, $setOnInsert: { createdAt: now } },
        upsert: true,
      },
    }))
  );
  return result.upsertedCount + result.modifiedCount;
}

export async function seedDemoData(db: Db): Promise<void> {
  const written = {
    DepartmentParent: await upsertAll(db, "DepartmentParent", "departmentId", DEPARTMENT_PARENTS),
    DepartmentChild: await upsertAll(db, "DepartmentChild", "childDeptId", DEPARTMENT_CHILDREN),
    Employee: await upsertAll(db, "Employee", "employeeId", EMPLOYEES),
    Project: await upsertAll(db, "Project", "projectId", PROJECTS),
    ProjectEmployee: await upsertAll(db, "ProjectEmployee", "empProjectId", ASSIGNMENTS),
    Counter: await raiseCounters(db),
  };
  for (const [collection, count] of Object.entries(written)) {
    console.log(`Seeded ${collection}: ${count}`);
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const client = new MongoClient(url);
  try {
    await client.connect();
    await seedDemoData(client.db());
  } finally {
    await client.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  });
}
