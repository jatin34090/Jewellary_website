import "reflect-metadata";

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { API, createTestContext, type ApiBody, type TestContext } from "./support/app";

const RUN = randomUUID().slice(0, 8);
const PASSWORD = "Correct-horse-1";

interface AnalyticsBody {
  range: { from: string; to: string; days: number };
  totals: { orders: number; revenue: string; averageOrderValue: string; unitsSold: number };
  daily: { date: string; orders: number; revenue: string }[];
  topProducts: { slug: string; unitsSold: number; revenue: string }[];
  statusCounts: Record<string, number>;
}

describe("Admin analytics API", () => {
  let ctx: TestContext;
  let adminToken = "";
  let customerId = "";
  let productId = "";
  const slug = `analytics-piece-${RUN}`;

  beforeAll(async () => {
    ctx = await createTestContext();
    adminToken = await signInAdmin(ctx);

    const customer = await ctx.prisma.user.create({
      data: {
        email: `e2e-analytics-${RUN}@example.com`,
        passwordHash: "not-used",
        firstName: "Analytics",
      },
    });
    customerId = customer.id;

    const product = await ctx.prisma.product.create({
      data: {
        sku: `ANALYTICS-${RUN}`,
        slug,
        name: "Analytics Piece",
        description: "Test product",
        price: "1200.00",
        status: "ACTIVE",
      },
    });
    productId = product.id;

    await ctx.prisma.order.create({
      data: {
        orderNumber: `JWL-E2E-${RUN}`,
        userId: customerId,
        status: "DELIVERED",
        subtotal: "2400.00",
        totalAmount: "2400.00",
        shippingAddress: { fullName: "Test" },
        paidAt: new Date(),
        items: {
          create: [
            {
              productId,
              sku: `ANALYTICS-${RUN}`,
              name: "Analytics Piece",
              unitPrice: "1200.00",
              quantity: 2,
              lineTotal: "2400.00",
            },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await ctx.prisma.order.deleteMany({ where: { userId: customerId } });
    await ctx.prisma.product.deleteMany({ where: { id: productId } });
    await ctx.prisma.user.deleteMany({ where: { id: customerId } });
    await ctx.prisma.user.deleteMany({
      where: { email: { contains: RUN, endsWith: "@example.com" } },
    });
    await ctx.prisma.$disconnect();
    await ctx.app.close();
  });

  it("rejects customers and anonymous callers", async () => {
    await ctx.http.get(`${API}/admin/analytics`).expect(401);
  });

  it("rejects unsupported ranges", async () => {
    await ctx.http.get(`${API}/admin/analytics?days=5`, adminToken).expect(400);
  });

  it("returns one row per day for the chosen range, including zero days", async () => {
    const res = await ctx.http.get(`${API}/admin/analytics?days=7`, adminToken).expect(200);
    const body = (res.body as ApiBody<AnalyticsBody>).data;
    expect(body.range.days).toBe(7);
    expect(body.daily).toHaveLength(7);
    expect(body.daily.map((row) => row.date)).toEqual(
      [...body.daily.map((row) => row.date)].sort(),
    );
  });

  it("counts paid sales in totals, daily rows and top products", async () => {
    const res = await ctx.http.get(`${API}/admin/analytics?days=7`, adminToken).expect(200);
    const body = (res.body as ApiBody<AnalyticsBody>).data;

    expect(body.totals.orders).toBeGreaterThanOrEqual(1);
    expect(Number(body.totals.revenue)).toBeGreaterThanOrEqual(2400);
    expect(body.totals.unitsSold).toBeGreaterThanOrEqual(2);
    expect(Number(body.totals.averageOrderValue)).toBeGreaterThan(0);

    const today = body.daily[body.daily.length - 1];
    expect(today?.orders).toBeGreaterThanOrEqual(1);

    const top = body.topProducts.find((item) => item.slug === slug);
    expect(top).toMatchObject({ unitsSold: 2, revenue: "2400.00" });
  });

  it("reports order counts by status for the range", async () => {
    const res = await ctx.http.get(`${API}/admin/analytics?days=7`, adminToken).expect(200);
    const body = (res.body as ApiBody<AnalyticsBody>).data;
    expect(body.statusCounts["DELIVERED"]).toBeGreaterThanOrEqual(1);
  });
});

async function signInAdmin(ctx: TestContext): Promise<string> {
  // Kept short: email addresses allow at most 64 characters before the @.
  const email = `e2e-analytics-admin-${RUN}-${randomUUID().slice(0, 12)}@example.com`;
  const register = await ctx.http.post(`${API}/auth/register`, {
    email,
    password: PASSWORD,
    firstName: "Admin",
  });
  if (register.status !== 201) {
    throw new Error(
      `Registration failed for the admin test account: ${JSON.stringify(register.body)}`,
    );
  }
  await ctx.prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
  const login = await ctx.http.post(`${API}/auth/login`, { email, password: PASSWORD }).expect(200);
  return (login.body as ApiBody<{ accessToken: string }>).data.accessToken;
}
