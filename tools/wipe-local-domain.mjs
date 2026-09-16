#!/usr/bin/env node
/**
 * Local-only Mongo wipe for domain collections used by prisma/seed.ts.
 * Requires: ALLOW_DB_WIPE=1 and DATABASE_URL that does not look like production Atlas.
 *
 * Usage: ALLOW_DB_WIPE=1 npm run db:wipe:local
 */
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const url = process.env.DATABASE_URL || '';
const allow = process.env.ALLOW_DB_WIPE === '1';

const COLLECTIONS = [
  'Counter',
  'DepartmentParent',
  'DepartmentChild',
  'Employee',
  'Project',
  'ProjectEmployee',
];

function isLocalMongoUrl(connectionUrl) {
  try {
    const parsed = new URL(connectionUrl);
    const host = (parsed.hostname || '').toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0'
    );
  } catch {
    const lower = connectionUrl.toLowerCase();
    return (
      lower.includes('localhost') ||
      lower.includes('127.0.0.1') ||
      lower.includes('::1')
    );
  }
}

function looksProduction(connectionUrl) {
  const lower = connectionUrl.toLowerCase();
  if (lower.includes('prod') || lower.includes('production')) {
    return true;
  }
  // Atlas / any non-local host requires an explicit override (still needs ALLOW_DB_WIPE).
  if (!isLocalMongoUrl(connectionUrl)) {
    return (
      process.env.EH_ALLOW_ATLAS_WIPE !== '1' &&
      process.env.EH_ALLOW_REMOTE_WIPE !== '1'
    );
  }
  return false;
}

async function main() {
  if (!allow) {
    console.error('Refusing wipe: set ALLOW_DB_WIPE=1');
    process.exit(1);
  }
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  if (looksProduction(url)) {
    console.error(
      'Refusing wipe: DATABASE_URL is not localhost. Use a local Mongo URL, or set EH_ALLOW_REMOTE_WIPE=1 / EH_ALLOW_ATLAS_WIPE=1 only if intentional.'
    );
    process.exit(1);
  }

  const client = new MongoClient(url);
  await client.connect();
  const db = client.db();
  for (const name of COLLECTIONS) {
    const result = await db.collection(name).deleteMany({});
    console.log(`Cleared ${name}: ${result.deletedCount}`);
  }
  await client.close();
  console.log('Local domain wipe complete. Run: npm run db:seed && npm run db:seed:auth');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
