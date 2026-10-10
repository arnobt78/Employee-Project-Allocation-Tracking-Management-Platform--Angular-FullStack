import { MongoClient } from "mongodb";

let mongoClientPromise;

/** Native-driver collection handle on a connection reused across invocations. */
export async function mongoCollection(name) {
  const databaseUrl =
    process.env.NG_APP_PRISMA_URL ||
    process.env.NG_APP_MONGODB_URI ||
    process.env.DATABASE_URL ||
    process.env.MONGODB_URI;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL not found in environment variables");
  }
  mongoClientPromise ??= new MongoClient(databaseUrl).connect().catch((error) => {
    mongoClientPromise = undefined;
    throw error;
  });
  const client = await mongoClientPromise;
  const dbName = databaseUrl.split("/").pop()?.split("?")[0] || "employee_management_db";
  return client.db(dbName).collection(name);
}
