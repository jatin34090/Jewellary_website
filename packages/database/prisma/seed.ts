import * as path from "node:path";
import { existsSync } from "node:fs";

import { createPrismaClient } from "../src/client";

/** Brand categories. Upserted by slug, so the seed is safe to run more than once. */
const CATEGORIES = [
  { name: "Earrings", slug: "earrings", sortOrder: 1 },
  { name: "Rings", slug: "rings", sortOrder: 2 },
  { name: "Pendants", slug: "pendants", sortOrder: 3 },
  { name: "Bracelets", slug: "bracelets", sortOrder: 4 },
  { name: "Anklets", slug: "anklets", sortOrder: 5 },
  { name: "Combo Sets", slug: "combo-sets", sortOrder: 6 },
] as const;

async function main(): Promise<void> {
  const envFile = path.resolve(__dirname, "../../../.env");
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const prisma = createPrismaClient(databaseUrl, { maxConnections: 2 });
  try {
    for (const category of CATEGORIES) {
      await prisma.category.upsert({
        where: { slug: category.slug },
        create: { ...category, isActive: true },
        update: {
          name: category.name,
          sortOrder: category.sortOrder,
          isActive: true,
          deletedAt: null,
        },
      });
    }
    const count = await prisma.category.count({ where: { deletedAt: null } });
    console.log(`Seeded ${CATEGORIES.length} categories. Visible categories now: ${count}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
