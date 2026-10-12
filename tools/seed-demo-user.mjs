import "dotenv/config";
import { pathToFileURL } from "node:url";
import bcrypt from "bcryptjs";
import { prisma } from "../api/_lib/prisma-client.mjs";

export const DEMO_USERNAME = "admin";
const DEMO_PASSWORD = "112233";
const BCRYPT_ROUNDS = 12;

export async function upsertDemoUser() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);
  const profile = {
    passwordHash,
    role: "admin",
    displayName: "Admin Account",
    isActive: true,
  };
  return prisma.appUser.upsert({
    where: { username: DEMO_USERNAME },
    update: profile,
    create: { username: DEMO_USERNAME, ...profile },
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const user = await upsertDemoUser();
  console.log(`Demo user seeded: ${user.username} (${user.displayName})`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main()
    .catch((error) => {
      console.error("Failed to seed demo user:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
