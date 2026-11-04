import "reflect-metadata";

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { API, createTestContext, type ApiBody, type TestContext } from "./support/app";

const RUN = randomUUID().slice(0, 8);
const CATEGORY_SLUG = `e2e-cat-${RUN}`;
const SLUG = {
  aurora: `aurora-ring-${RUN}`,
  solstice: `solstice-ring-${RUN}`,
  orbit: `orbit-band-${RUN}`,
  draft: `aurora-hidden-draft-${RUN}`,
};
const PASSWORD = "Correct-horse-1";

interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  price: string;
  discountPercent: number | null;
  availability: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  primaryImage: { url: string } | null;
}

interface ProductPage {
  items: ProductSummary[];
  nextCursor: string | null;
}

interface ProductDetail extends ProductSummary {
  sku: string;
  description: string;
  images: { url: string; isPrimary: boolean }[];
  categories: { slug: string }[];
  related: ProductSummary[];
}

interface AdminProduct {
  id: string;
  sku: string;
  slug: string;
  status: string;
  images: { id: string; isPrimary: boolean; sortOrder: number; publicId: string }[];
  inventory: { quantityOnHand: number; availability: string } | null;
}

interface CategoryData {
  id: string;
  slug: string;
}

describe("Catalogue and admin catalogue API", () => {
  let ctx: TestContext;
  let adminToken = "";
  let customerToken = "";
  const createdProductIds: string[] = [];
  const createdCategoryIds: string[] = [];
  let categoryId = "";

  // Products created for the catalogue scenarios.
  const ids = {} as Record<"aurora" | "solstice" | "orbit" | "draft", string>;

  beforeAll(async () => {
    ctx = await createTestContext();
    adminToken = await signIn(ctx, "ADMIN");
    customerToken = await signIn(ctx, "CUSTOMER");

    const category = await ctx.http
      .post(
        `${API}/admin/categories`,
        { name: `E2E Category ${RUN}`, slug: CATEGORY_SLUG },
        adminToken,
      )
      .expect(201);
    categoryId = (category.body as ApiBody<CategoryData>).data.id;
    createdCategoryIds.push(categoryId);

    const aurora = await createProduct(ctx, adminToken, {
      sku: `E2E-${RUN}-A`,
      name: "Aurora Ring",
      price: "1000.00",
      compareAtPrice: "1250.00",
      slug: SLUG.aurora,
      status: "ACTIVE",
      initialStock: 10,
      lowStockThreshold: 2,
      categoryIds: [categoryId],
    });
    const solstice = await createProduct(ctx, adminToken, {
      sku: `E2E-${RUN}-B`,
      name: "Solstice Ring",
      slug: SLUG.solstice,
      price: "2500.50",
      status: "ACTIVE",
      initialStock: 0,
      categoryIds: [categoryId],
    });
    const orbit = await createProduct(ctx, adminToken, {
      sku: `E2E-${RUN}-C`,
      name: "Orbit Band",
      slug: SLUG.orbit,
      price: "500.00",
      status: "ACTIVE",
      initialStock: 2,
      lowStockThreshold: 2,
      categoryIds: [categoryId],
    });
    const draft = await createProduct(ctx, adminToken, {
      sku: `E2E-${RUN}-D`,
      name: "Aurora Hidden Draft",
      slug: SLUG.draft,
      price: "700.00",
      status: "DRAFT",
      initialStock: 5,
      categoryIds: [categoryId],
    });

    ids.aurora = aurora.id;
    ids.solstice = solstice.id;
    ids.orbit = orbit.id;
    ids.draft = draft.id;
    createdProductIds.push(aurora.id, solstice.id, orbit.id, draft.id);
  });

  afterAll(async () => {
    {
      // Audit rows reference these entities, so remove them too. Products cascade to images and stock.
      const entityIds = [...createdProductIds, ...createdCategoryIds];
      await ctx.prisma.auditLog.deleteMany({ where: { entityId: { in: entityIds } } });
      await ctx.prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
      await ctx.prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
      await ctx.prisma.user.deleteMany({
        where: { email: { contains: RUN, endsWith: "@example.com" } },
      });
      await ctx.prisma.$disconnect();
      await ctx.app.close();
    }
  });

  describe("permissions", () => {
    it("rejects anonymous writes with 401", async () => {
      await ctx.http.post(`${API}/admin/categories`, { name: "Nope" }).expect(401);
    });

    it("rejects customer writes with 403", async () => {
      await ctx.http
        .post(
          `${API}/admin/products`,
          { sku: "E2E-NOPE-1", name: "Nope", description: "x", price: "1" },
          customerToken,
        )
        .expect(403);
    });
  });

  describe("categories", () => {
    it("exposes the category tree publicly", async () => {
      const res = await ctx.http.get(`${API}/categories`).expect(200);
      const roots = (res.body as ApiBody<{ slug: string; children: unknown[] }[]>).data;
      expect(Array.isArray(roots)).toBe(true);
      expect(roots.some((node) => node.slug === CATEGORY_SLUG)).toBe(true);
    });

    it("generates a slug from the name and rejects duplicates with 409", async () => {
      const res = await ctx.http
        .post(`${API}/admin/categories`, { name: `Dup ${RUN}` }, adminToken)
        .expect(201);
      const created = (res.body as ApiBody<CategoryData>).data;
      createdCategoryIds.push(created.id);
      expect(created.slug).toBe(`dup-${RUN}`);

      await ctx.http
        .post(`${API}/admin/categories`, { name: `Dup ${RUN}` }, adminToken)
        .expect(409);
    });

    it("refuses to delete a category that still has subcategories", async () => {
      const parent = await ctx.http
        .post(`${API}/admin/categories`, { name: `Parent ${RUN}` }, adminToken)
        .expect(201);
      const parentId = (parent.body as ApiBody<CategoryData>).data.id;
      createdCategoryIds.push(parentId);
      const child = await ctx.http
        .post(`${API}/admin/categories`, { name: `Child ${RUN}`, parentId }, adminToken)
        .expect(201);
      createdCategoryIds.push((child.body as ApiBody<CategoryData>).data.id);

      await ctx.http.delete(`${API}/admin/categories/${parentId}`, adminToken).expect(409);
    });

    it("rejects a re-parenting that would create a loop", async () => {
      const a = await ctx.http
        .post(`${API}/admin/categories`, { name: `Loop A ${RUN}` }, adminToken)
        .expect(201);
      const aId = (a.body as ApiBody<CategoryData>).data.id;
      createdCategoryIds.push(aId);
      const b = await ctx.http
        .post(`${API}/admin/categories`, { name: `Loop B ${RUN}`, parentId: aId }, adminToken)
        .expect(201);
      const bId = (b.body as ApiBody<CategoryData>).data.id;
      createdCategoryIds.push(bId);

      await ctx.http
        .patch(`${API}/admin/categories/${aId}`, { parentId: bId }, adminToken)
        .expect(400);
    });
  });

  describe("admin product rules", () => {
    it("rejects a compare-at price below the selling price", async () => {
      await ctx.http
        .post(
          `${API}/admin/products`,
          {
            sku: `E2E-${RUN}-X1`,
            name: "Bad price",
            description: "x",
            price: "900.00",
            compareAtPrice: "800.00",
          },
          adminToken,
        )
        .expect(400);
    });

    it("clears the compare-at price when the admin sends null", async () => {
      const product = await createProduct(ctx, adminToken, {
        sku: `E2E-${RUN}-CLR`,
        name: "Clearable",
        slug: `clearable-${RUN}`,
        price: "400.00",
        compareAtPrice: "500.00",
        status: "ACTIVE",
      });
      createdProductIds.push(product.id);

      const res = await ctx.http
        .patch(`${API}/admin/products/${product.id}`, { compareAtPrice: null }, adminToken)
        .expect(200);
      expect(
        (res.body as ApiBody<{ compareAtPrice: string | null }>).data.compareAtPrice,
      ).toBeNull();

      const shown = await ctx.http.get(`${API}/products/clearable-${RUN}`).expect(200);
      expect((shown.body as ApiBody<ProductDetail>).data.discountPercent).toBeNull();
    });

    it("rejects a duplicate SKU with 409 (SKUs are case-insensitive)", async () => {
      await ctx.http
        .post(
          `${API}/admin/products`,
          { sku: `e2e-${RUN}-a`, name: "Copy", description: "x", price: "10.00" },
          adminToken,
        )
        .expect(409);
    });

    it("does not allow stock to go negative or below reserved units", async () => {
      await ctx.http
        .patch(
          `${API}/admin/products/${ids.orbit}/inventory`,
          { mode: "ADJUST", quantity: -50, reason: "Test drop" },
          adminToken,
        )
        .expect(400);
    });

    it("records stock changes and returns the new level", async () => {
      const res = await ctx.http
        .patch(
          `${API}/admin/products/${ids.orbit}/inventory`,
          { mode: "SET", quantity: 7, reason: "Recount" },
          adminToken,
        )
        .expect(200);
      expect((res.body as ApiBody<{ quantityOnHand: number }>).data.quantityOnHand).toBe(7);

      const audit = await ctx.prisma.auditLog.findFirst({
        where: { entityId: ids.orbit, action: "inventory.adjusted" },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).not.toBeNull();

      // Restore the level the availability scenarios below depend on.
      await ctx.http
        .patch(
          `${API}/admin/products/${ids.orbit}/inventory`,
          { mode: "SET", quantity: 2, reason: "Restore" },
          adminToken,
        )
        .expect(200);
    });

    it("moves a product's primary image when the primary one is removed", async () => {
      const added = await addImage(ctx, adminToken, ids.aurora, "first", true);
      const second = await addImage(ctx, adminToken, ids.aurora, "second", false);
      expect(added.images.find((i) => i.publicId === "first")?.isPrimary).toBe(true);
      expect(second.images.find((i) => i.publicId === "second")?.isPrimary).toBe(false);

      const firstId = added.images.find((i) => i.publicId === "first")?.id ?? "";
      await ctx.http
        .delete(`${API}/admin/products/${ids.aurora}/images/${firstId}`, adminToken)
        .expect(204);

      const after = await ctx.http
        .get(`${API}/admin/products/${ids.aurora}`, adminToken)
        .expect(200);
      const images = (after.body as ApiBody<AdminProduct>).data.images;
      expect(images).toHaveLength(1);
      expect(images[0]?.publicId).toBe("second");
      expect(images[0]?.isPrimary).toBe(true);
    });

    it("soft-deletes an empty category", async () => {
      const leaf = await ctx.http
        .post(`${API}/admin/categories`, { name: `Leaf ${RUN}` }, adminToken)
        .expect(201);
      const leafId = (leaf.body as ApiBody<CategoryData>).data.id;
      createdCategoryIds.push(leafId);
      await ctx.http.delete(`${API}/admin/categories/${leafId}`, adminToken).expect(204);
    });
  });

  describe("public catalogue", () => {
    it("lists only active products and hides drafts", async () => {
      const res = await ctx.http
        .get(`${API}/products?category=${CATEGORY_SLUG}&limit=50`)
        .expect(200);
      const names = (res.body as ApiBody<ProductPage>).data.items.map((item) => item.name);
      expect(names).toContain("Aurora Ring");
      expect(names).not.toContain("Aurora Hidden Draft");
    });

    it("sorts by price ascending and paginates with a cursor without duplicates", async () => {
      const first = await ctx.http
        .get(`${API}/products?category=${CATEGORY_SLUG}&sort=price_asc&limit=2`)
        .expect(200);
      const firstPage = (first.body as ApiBody<ProductPage>).data;
      expect(firstPage.items.map((item) => item.price)).toEqual(["500.00", "1000.00"]);
      expect(firstPage.nextCursor).not.toBeNull();

      const second = await ctx.http
        .get(
          `${API}/products?category=${CATEGORY_SLUG}&sort=price_asc&limit=2&cursor=${encodeURIComponent(firstPage.nextCursor ?? "")}`,
        )
        .expect(200);
      const secondPage = (second.body as ApiBody<ProductPage>).data;
      expect(secondPage.items.map((item) => item.price)).toEqual(["2500.50"]);
      expect(secondPage.nextCursor).toBeNull();
    });

    it("sorts by price descending", async () => {
      const res = await ctx.http
        .get(`${API}/products?category=${CATEGORY_SLUG}&sort=price_desc`)
        .expect(200);
      const prices = (res.body as ApiBody<ProductPage>).data.items.map((item) =>
        Number(item.price),
      );
      expect(prices).toEqual([...prices].sort((a, b) => b - a));
    });

    it("filters by price range", async () => {
      const res = await ctx.http
        .get(`${API}/products?category=${CATEGORY_SLUG}&minPrice=900&maxPrice=2600`)
        .expect(200);
      const names = (res.body as ApiBody<ProductPage>).data.items.map((item) => item.name).sort();
      expect(names).toEqual(["Aurora Ring", "Solstice Ring"]);
    });

    it("searches with full-text matching", async () => {
      const res = await ctx.http
        .get(`${API}/products?category=${CATEGORY_SLUG}&q=aurora`)
        .expect(200);
      const items = (res.body as ApiBody<ProductPage>).data.items;
      expect(items.map((item) => item.name)).toEqual(["Aurora Ring"]);
    });

    it("returns 400 for an invalid or tampered cursor", async () => {
      await ctx.http.get(`${API}/products?cursor=not-a-cursor`).expect(400);
      const forged = Buffer.from(JSON.stringify({ v: "DROP TABLE", id: "x" })).toString(
        "base64url",
      );
      await ctx.http.get(`${API}/products?sort=price_asc&cursor=${forged}`).expect(400);
    });

    it("returns 400 for an invalid price", async () => {
      await ctx.http.get(`${API}/products?minPrice=abc`).expect(400);
    });

    it("returns 400 when minPrice is above maxPrice", async () => {
      await ctx.http.get(`${API}/products?minPrice=500&maxPrice=100`).expect(400);
    });

    it("shows discount and availability without exact stock counts", async () => {
      const res = await ctx.http.get(`${API}/products/${SLUG.aurora}`).expect(200);
      const body = res.body as ApiBody<ProductDetail>;
      expect(body.data.availability).toBe("IN_STOCK");
      expect(body.data.discountPercent).toBe(20);
      expect(JSON.stringify(body.data)).not.toContain("quantityOnHand");
    });

    it("marks an empty product OUT_OF_STOCK and a low one LOW_STOCK", async () => {
      const solstice = await ctx.http.get(`${API}/products/${SLUG.solstice}`).expect(200);
      expect((solstice.body as ApiBody<ProductDetail>).data.availability).toBe("OUT_OF_STOCK");

      const orbit = await ctx.http.get(`${API}/products/${SLUG.orbit}`).expect(200);
      expect((orbit.body as ApiBody<ProductDetail>).data.availability).toBe("LOW_STOCK");
    });

    it("returns related products in the same category and never the product itself", async () => {
      const res = await ctx.http.get(`${API}/products/${SLUG.aurora}`).expect(200);
      const related = (res.body as ApiBody<ProductDetail>).data.related.map((item) => item.name);
      expect(related).toContain("Solstice Ring");
      expect(related).not.toContain("Aurora Ring");
    });

    it("returns 404 for a draft product", async () => {
      await ctx.http.get(`${API}/products/${SLUG.draft}`).expect(404);
    });

    it("includes products in subcategories when filtering by a parent category", async () => {
      const parent = await createCategory(ctx, adminToken, `Tree Parent ${RUN}`);
      createdCategoryIds.push(parent.id);
      const child = await createCategory(ctx, adminToken, `Tree Child ${RUN}`, parent.id);
      createdCategoryIds.push(child.id);
      const product = await createProduct(ctx, adminToken, {
        sku: `E2E-${RUN}-TREE`,
        name: "Tree Product",
        slug: `tree-product-${RUN}`,
        price: "300.00",
        status: "ACTIVE",
        initialStock: 1,
        categoryIds: [child.id],
      });
      createdProductIds.push(product.id);

      const underParent = await ctx.http
        .get(`${API}/products?category=${parent.slug}&limit=50`)
        .expect(200);
      const parentSlugs = (underParent.body as ApiBody<ProductPage>).data.items.map((i) => i.slug);
      expect(parentSlugs).toContain(`tree-product-${RUN}`);

      const underChild = await ctx.http
        .get(`${API}/products?category=${child.slug}&limit=50`)
        .expect(200);
      const childSlugs = (underChild.body as ApiBody<ProductPage>).data.items.map((i) => i.slug);
      expect(childSlugs).toEqual([`tree-product-${RUN}`]);
    });

    it("returns every product across pages for a category with more than 24 products", async () => {
      const bulk = await createCategory(ctx, adminToken, `Bulk ${RUN}`);
      createdCategoryIds.push(bulk.id);
      for (let i = 1; i <= 24; i += 1) {
        const product = await createProduct(ctx, adminToken, {
          sku: `E2E-${RUN}-BULK-${String(i).padStart(2, "0")}`,
          name: `Bulk Product ${i}`,
          slug: `bulk-product-${RUN}-${String(i).padStart(2, "0")}`,
          price: `${100 + i}.00`,
          status: "ACTIVE",
          initialStock: 3,
          categoryIds: [bulk.id],
        });
        createdProductIds.push(product.id);
      }

      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      for (;;) {
        const suffix: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
        const res: { body: unknown } = await ctx.http
          .get(`${API}/products?category=${bulk.slug}&limit=10${suffix}`)
          .expect(200);
        const page: ProductPage = (res.body as ApiBody<ProductPage>).data;
        seen.push(...page.items.map((item: ProductSummary) => item.slug));
        pages += 1;
        cursor = page.nextCursor;
        if (!cursor || pages >= 10) break;
      }

      expect(pages).toBe(3);
      expect(seen).toHaveLength(24);
      expect(new Set(seen).size).toBe(24);
    });

    it("returns an empty list, not an error, for a category with no products", async () => {
      const empty = await createCategory(ctx, adminToken, `Empty ${RUN}`);
      createdCategoryIds.push(empty.id);

      const res = await ctx.http.get(`${API}/products?category=${empty.slug}&limit=10`).expect(200);
      const page = (res.body as ApiBody<ProductPage>).data;
      expect(page.items).toEqual([]);
      expect(page.nextCursor).toBeNull();
    });
  });
});

async function createCategory(
  ctx: TestContext,
  token: string,
  name: string,
  parentId?: string,
): Promise<CategoryData> {
  const res = await ctx.http
    .post(`${API}/admin/categories`, parentId ? { name, parentId } : { name }, token)
    .expect(201);
  return (res.body as ApiBody<CategoryData>).data;
}

async function signIn(ctx: TestContext, role: "CUSTOMER" | "ADMIN"): Promise<string> {
  const email = `e2e-${RUN}-${role.toLowerCase()}-${randomUUID()}@example.com`;
  const register = await ctx.http
    .post(`${API}/auth/register`, { email, password: PASSWORD, firstName: "Test" })
    .expect(201);
  if (role === "ADMIN") {
    await ctx.prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
    const login = await ctx.http
      .post(`${API}/auth/login`, { email, password: PASSWORD })
      .expect(200);
    return (login.body as ApiBody<{ accessToken: string }>).data.accessToken;
  }
  return (register.body as ApiBody<{ accessToken: string }>).data.accessToken;
}

async function createProduct(
  ctx: TestContext,
  token: string,
  input: Record<string, unknown>,
): Promise<AdminProduct> {
  const res = await ctx.http
    .post(`${API}/admin/products`, { description: "Test product", ...input }, token)
    .expect(201);
  return (res.body as ApiBody<AdminProduct>).data;
}

async function addImage(
  ctx: TestContext,
  token: string,
  productId: string,
  publicId: string,
  isPrimary: boolean,
): Promise<AdminProduct> {
  const res = await ctx.http
    .post(
      `${API}/admin/products/${productId}/images`,
      { url: `https://res.cloudinary.com/demo/image/upload/${publicId}.jpg`, publicId, isPrimary },
      token,
    )
    .expect(201);
  return (res.body as ApiBody<AdminProduct>).data;
}
