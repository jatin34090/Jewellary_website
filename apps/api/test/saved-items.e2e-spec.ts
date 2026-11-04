import "reflect-metadata";

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { API, createTestContext, type ApiBody, type TestContext } from "./support/app";

const RUN = randomUUID().slice(0, 8);
const PASSWORD = "Correct-horse-1";

interface SavedBagLine {
  slug: string;
  productId: string;
  name: string;
  image: string | null;
  quantity: number;
}

describe("Saved bag and wishlist API", () => {
  let ctx: TestContext;
  let token = "";
  let otherToken = "";
  const productIds: string[] = [];
  const live = `saved-live-${RUN}`;
  const liveTwo = `saved-live-two-${RUN}`;
  const archived = `saved-archived-${RUN}`;

  beforeAll(async () => {
    ctx = await createTestContext();
    token = await register(ctx, "shopper");
    otherToken = await register(ctx, "other");

    for (const [slug, status, deletedAt] of [
      [live, "ACTIVE", null],
      [liveTwo, "ACTIVE", null],
      [archived, "DRAFT", null],
    ] as const) {
      const product = await ctx.prisma.product.create({
        data: {
          sku: `SAVED-${slug}`.toUpperCase(),
          slug,
          name: `Saved ${slug}`,
          description: "Test product",
          price: "100.00",
          status,
          deletedAt,
        },
      });
      productIds.push(product.id);
    }
  });

  afterAll(async () => {
    await ctx.prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await ctx.prisma.user.deleteMany({
      where: { email: { contains: RUN, endsWith: "@example.com" } },
    });
    await ctx.prisma.$disconnect();
    await ctx.app.close();
  });

  it("requires a signed-in customer", async () => {
    await ctx.http.get(`${API}/account/bag`).expect(401);
    await ctx.http.put(`${API}/account/wishlist`, { slugs: [] }).expect(401);
  });

  it("starts empty for a new customer", async () => {
    const bag = await ctx.http.get(`${API}/account/bag`, token).expect(200);
    expect((bag.body as ApiBody<SavedBagLine[]>).data).toEqual([]);
    const wishlist = await ctx.http.get(`${API}/account/wishlist`, token).expect(200);
    expect((wishlist.body as ApiBody<string[]>).data).toEqual([]);
  });

  it("saves bag lines, drops unknown and archived products and merges duplicates", async () => {
    const res = await ctx.http
      .put(
        `${API}/account/bag`,
        {
          lines: [
            { slug: live, quantity: 2 },
            { slug: live, quantity: 5 },
            { slug: archived, quantity: 1 },
            { slug: `no-such-product-${RUN}`, quantity: 1 },
            { slug: liveTwo, quantity: 1 },
          ],
        },
        token,
      )
      .expect(200);
    const lines = (res.body as ApiBody<SavedBagLine[]>).data;
    expect(lines.map((line) => line.slug)).toEqual([live, liveTwo]);
    expect(lines[0]?.quantity).toBe(2);
  });

  it("replaces the bag rather than appending to it", async () => {
    const res = await ctx.http
      .put(`${API}/account/bag`, { lines: [{ slug: liveTwo, quantity: 3 }] }, token)
      .expect(200);
    const lines = (res.body as ApiBody<SavedBagLine[]>).data;
    expect(lines).toHaveLength(1);
    expect(lines[0]?.slug).toBe(liveTwo);
    expect(lines[0]?.quantity).toBe(3);
  });

  it("keeps each customer's bag separate", async () => {
    const res = await ctx.http.get(`${API}/account/bag`, otherToken).expect(200);
    expect((res.body as ApiBody<SavedBagLine[]>).data).toEqual([]);
  });

  it("rejects quantities above the limit and malformed slugs", async () => {
    await ctx.http
      .put(`${API}/account/bag`, { lines: [{ slug: live, quantity: 11 }] }, token)
      .expect(400);
    await ctx.http
      .put(`${API}/account/bag`, { lines: [{ slug: "Not A Slug", quantity: 1 }] }, token)
      .expect(400);
  });

  it("saves the wishlist as slugs and hides products that were archived later", async () => {
    await ctx.http.put(`${API}/account/wishlist`, { slugs: [live, liveTwo] }, token).expect(200);

    await ctx.prisma.product.update({
      where: { slug: liveTwo },
      data: { status: "DRAFT" },
    });
    const res = await ctx.http.get(`${API}/account/wishlist`, token).expect(200);
    expect((res.body as ApiBody<string[]>).data).toEqual([live]);

    await ctx.prisma.product.update({ where: { slug: liveTwo }, data: { status: "ACTIVE" } });
  });

  it("replaces the wishlist and rejects more than 100 entries", async () => {
    const res = await ctx.http
      .put(`${API}/account/wishlist`, { slugs: [liveTwo] }, token)
      .expect(200);
    expect((res.body as ApiBody<string[]>).data).toEqual([liveTwo]);

    const tooMany = Array.from({ length: 101 }, (_, i) => `item-${String(i)}`);
    await ctx.http.put(`${API}/account/wishlist`, { slugs: tooMany }, token).expect(400);
  });
});

async function register(ctx: TestContext, label: string): Promise<string> {
  const email = `e2e-saved-${label}-${RUN}-${randomUUID()}@example.com`;
  const res = await ctx.http
    .post(`${API}/auth/register`, { email, password: PASSWORD, firstName: "Test" })
    .expect(201);
  return (res.body as ApiBody<{ accessToken: string }>).data.accessToken;
}
