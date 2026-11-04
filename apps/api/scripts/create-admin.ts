import * as path from "node:path";
import { existsSync } from "node:fs";

import { createPrismaClient, UserRole } from "@jewellery/database";

import { hashPassword } from "../src/modules/auth/password";

/**
 * Creates the first admin account, or promotes an existing account to admin.
 *
 * Reads ADMIN_EMAIL, ADMIN_PASSWORD, and optionally ADMIN_FIRST_NAME and ADMIN_LAST_NAME
 * from the root .env file or the environment. The password is only used when the account
 * is created; an existing account keeps its password.
 */
async function main(): Promise<void> {
  const envFile = path.resolve(__dirname, "../../../.env");
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }

  const databaseUrl = process.env["DATABASE_URL"];
  const email = process.env["ADMIN_EMAIL"]?.trim().toLowerCase();
  const password = process.env["ADMIN_PASSWORD"];
  const firstName = process.env["ADMIN_FIRST_NAME"]?.trim() || "Admin";
  const lastName = process.env["ADMIN_LAST_NAME"]?.trim() || null;

  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("ADMIN_EMAIL must be a valid email address");
  }
  if (!password || password.length < 8 || password.length > 128) {
    throw new Error("ADMIN_PASSWORD must be between 8 and 128 characters");
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("ADMIN_PASSWORD must contain at least one letter and one digit");
  }

  const prisma = createPrismaClient(databaseUrl, { maxConnections: 2 });
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role === UserRole.ADMIN && existing.isActive && !existing.deletedAt) {
        console.log(`${email} is already an active admin. Nothing changed.`);
        return;
      }
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: UserRole.ADMIN, isActive: true, deletedAt: null },
      });
      console.log(`Promoted existing account ${email} to admin. Password unchanged.`);
      return;
    }

    await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        firstName,
        lastName,
        role: UserRole.ADMIN,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`Created admin account ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
