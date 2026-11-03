import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client";

export type AppPrismaClient = PrismaClient;

/**
 * Creates a Prisma client on the pg driver adapter.
 * Connection pooling is handled by the adapter's pg Pool. `max` caps connections per process.
 */
export function createPrismaClient(
  connectionString: string,
  options: { maxConnections?: number } = {},
): AppPrismaClient {
  const adapter = new PrismaPg({
    connectionString,
    max: options.maxConnections ?? 10,
  });
  return new PrismaClient({ adapter });
}
