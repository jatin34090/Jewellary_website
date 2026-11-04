import { randomUUID } from "node:crypto";

import { createPrismaClient, type AppPrismaClient } from "@jewellery/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadEnv } from "../src/config/env";
import { applyTestEnv } from "./support/test-env";

/**
 * The database is the last line of defence. These checks confirm that invalid money and
 * stock values are rejected even if application code has a bug.
 */
describe("Database integrity constraints", () => {
  let prisma: AppPrismaClient;
  const createdCouponCodes: string[] = [];

  beforeAll(() => {
    applyTestEnv();
    prisma = createPrismaClient(loadEnv().databaseUrl, { maxConnections: 2 });
  });

  afterAll(async () => {
    await prisma.coupon.deleteMany({ where: { code: { in: createdCouponCodes } } });
    await prisma.$disconnect();
  });

  async function insertCoupon(overrides: {
    code: string;
    discountType: string;
    discountValue: number;
  }) {
    createdCouponCodes.push(overrides.code);
    return prisma.$executeRawUnsafe(
      `INSERT INTO "Coupon" ("id", "code", "discountType", "discountValue", "minOrderAmount", "usedCount", "startsAt", "isActive", "createdAt", "updatedAt")
       VALUES ($1::uuid, $2, $3::"DiscountType", $4, 0, 0, now(), true, now(), now())`,
      randomUUID(),
      overrides.code,
      overrides.discountType,
      overrides.discountValue,
    );
  }

  it("accepts a valid percentage coupon", async () => {
    await expect(
      insertCoupon({
        code: `E2E-OK-${randomUUID().slice(0, 8)}`,
        discountType: "PERCENTAGE",
        discountValue: 10,
      }),
    ).resolves.toBe(1);
  });

  it("rejects a percentage coupon above 100", async () => {
    await expect(
      insertCoupon({
        code: `E2E-BAD-${randomUUID().slice(0, 8)}`,
        discountType: "PERCENTAGE",
        discountValue: 150,
      }),
    ).rejects.toThrow(/Coupon_percentage_max_100/);
  });

  it("rejects a zero or negative coupon value", async () => {
    await expect(
      insertCoupon({
        code: `E2E-NEG-${randomUUID().slice(0, 8)}`,
        discountType: "FIXED_AMOUNT",
        discountValue: -5,
      }),
    ).rejects.toThrow(/Coupon_discount_value_positive/);
  });
});
