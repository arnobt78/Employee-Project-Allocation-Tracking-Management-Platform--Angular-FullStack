import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../api/_lib/prisma-client.mjs";

const DEMO_USERNAME = "admin";
const DEMO_PASSWORD = "112233";
const BCRYPT_ROUNDS = 12;

async function seedDemoUser() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  const user = await prisma.appUser.upsert({
    where: { username: DEMO_USERNAME },
    update: {
      passwordHash,
      role: "admin",
      displayName: "Admin Account",
      isActive: true,
    },
    create: {
      username: DEMO_USERNAME,
      passwordHash,
      role: "admin",
      displayName: "Admin Account",
      isActive: true,
    },
  });

  console.log(`Demo user seeded: ${user.username} (${user.displayName})`);
}

seedDemoUser()
  .catch((error) => {
    console.error("Failed to seed demo user:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
