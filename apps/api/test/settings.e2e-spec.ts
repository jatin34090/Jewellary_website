import "reflect-metadata";

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { API, createTestContext, type ApiBody, type TestContext } from "./support/app";

const RUN = randomUUID().slice(0, 8);
// Banners must sit on the configured Cloudinary account, so the tests use that cloud name when it is set.
const cloud = () => process.env["CLOUDINARY_CLOUD_NAME"] || "demo";
const PASSWORD = "Correct-horse-1";
const SETTING_KEYS = [
  "checkout.shipping.flatRate",
  "checkout.shipping.freeAbove",
  "checkout.taxPercent",
  "store.brand",
  "store.theme",
  "home.sections",
];

interface CheckoutSettings {
  flatRate: string;
  freeShippingAbove: string | null;
  taxPercent: string;
}

interface QuoteData {
  subtotal: string;
  shipping: string;
  tax: string;
  total: string;
}

interface Banner {
  id: string;
  title: string;
  placement: string;
  isActive: boolean;
}

describe("Shipping, tax, store settings, banners and customers", () => {
  let ctx: TestContext;
  let adminToken = "";
  let customerToken = "";
  let productId = "";
  const bannerIds: string[] = [];

  beforeAll(async () => {
    ctx = await createTestContext();

    const admin = await register(`e2e-settings-admin-${RUN}@example.com`);
    await ctx.prisma.user.update({
      where: { email: `e2e-settings-admin-${RUN}@example.com` },
      data: { role: "ADMIN" },
    });
    adminToken = (
      (
        await ctx.http
          .post(`${API}/auth/login`, {
            email: `e2e-settings-admin-${RUN}@example.com`,
            password: PASSWORD,
          })
          .expect(200)
      ).body as ApiBody<{ accessToken: string }>
    ).data.accessToken;
    expect(admin.token).toBeTruthy();

    customerToken = (await register(`e2e-settings-customer-${RUN}@example.com`)).token;

    const product = await ctx.http
      .post(
        `${API}/admin/products`,
        {
          sku: `SET-${RUN}`,
          name: "Settings Test Ring",
          slug: `settings-test-ring-${RUN}`,
          description: "Used to check how shipping and tax change totals.",
          price: "1000.00",
          status: "ACTIVE",
          initialStock: 20,
        },
        adminToken,
      )
      .expect(201);
    productId = (product.body as ApiBody<{ id: string }>).data.id;
  });

  afterAll(async () => {
    // Put settings back to their defaults so other suites see zero shipping and tax.
    await ctx.prisma.storeSetting.deleteMany({ where: { key: { in: SETTING_KEYS } } });
    await ctx.prisma.banner.deleteMany({ where: { id: { in: bannerIds } } });
    await ctx.prisma.auditLog.deleteMany({ where: { entityId: productId } });
    await ctx.prisma.product.deleteMany({ where: { id: productId } });
    await ctx.prisma.user.deleteMany({
      where: { email: { contains: RUN, endsWith: "@example.com" } },
    });
    await ctx.prisma.$disconnect();
    await ctx.app.close();
  });

  async function register(email: string): Promise<{ token: string }> {
    const res = await ctx.http
      .post(`${API}/auth/register`, { email, password: PASSWORD, firstName: "E2E" })
      .expect(201);
    return { token: (res.body as ApiBody<{ accessToken: string }>).data.accessToken };
  }

  describe("shipping and tax", () => {
    it("keeps the screen for administrators only", async () => {
      await ctx.http.get(`${API}/admin/settings/checkout`).expect(401);
      await ctx.http.get(`${API}/admin/settings/checkout`, customerToken).expect(403);
    });

    it("rejects an invalid tax rate or shipping amount", async () => {
      await ctx.http
        .put(
          `${API}/admin/settings/checkout`,
          { flatRate: "99", freeShippingAbove: null, taxPercent: "150" },
          adminToken,
        )
        .expect(400);
      await ctx.http
        .put(
          `${API}/admin/settings/checkout`,
          { flatRate: "abc", freeShippingAbove: null, taxPercent: "3" },
          adminToken,
        )
        .expect(400);
    });

    it("saves the rules and applies them to the next quote", async () => {
      const saved = await ctx.http
        .put(
          `${API}/admin/settings/checkout`,
          { flatRate: "99.00", freeShippingAbove: "2999.00", taxPercent: "3" },
          adminToken,
        )
        .expect(200);
      expect((saved.body as ApiBody<CheckoutSettings>).data).toEqual({
        flatRate: "99.00",
        freeShippingAbove: "2999.00",
        taxPercent: "3.00",
      });

      // 1000 subtotal: 99 shipping, and 3% tax on 1000 is 30.
      const below = await ctx.http
        .post(`${API}/checkout/quote`, { items: [{ productId, quantity: 1 }] })
        .expect(200);
      expect((below.body as ApiBody<QuoteData>).data).toMatchObject({
        subtotal: "1000.00",
        shipping: "99.00",
        tax: "30.00",
        total: "1129.00",
      });

      // 3000 subtotal qualifies for free shipping. Tax is 90.
      const above = await ctx.http
        .post(`${API}/checkout/quote`, { items: [{ productId, quantity: 3 }] })
        .expect(200);
      expect((above.body as ApiBody<QuoteData>).data).toMatchObject({
        shipping: "0.00",
        tax: "90.00",
        total: "3090.00",
      });
    });

    it("removes the free-shipping threshold when it is cleared", async () => {
      await ctx.http
        .put(
          `${API}/admin/settings/checkout`,
          { flatRate: "99.00", freeShippingAbove: null, taxPercent: "3" },
          adminToken,
        )
        .expect(200);
      const res = await ctx.http
        .post(`${API}/checkout/quote`, { items: [{ productId, quantity: 3 }] })
        .expect(200);
      expect((res.body as ApiBody<QuoteData>).data.shipping).toBe("99.00");
    });
  });

  describe("store settings", () => {
    it("serves defaults publicly before anything is saved", async () => {
      const res = await ctx.http.get(`${API}/store/settings`).expect(200);
      const data = (res.body as ApiBody<{ brand: { name: string }; theme: { brown: string } }>)
        .data;
      expect(data.brand.name).toBe("VRINOOR");
      expect(data.theme.brown).toBe("#38251d");
    });

    it("rejects a non-Cloudinary logo, a bad colour and an unknown section", async () => {
      const base = {
        brand: {
          name: "VRINOOR",
          tagline: "",
          description: "",
          logoUrl: null,
          faviconUrl: null,
          email: "vrinoor.jewels@gmail.com",
          phone: null,
          address: null,
          socialLinks: [],
        },
        theme: { brown: "#38251d", cream: "#f8f1e7", gold: "#b39465" },
        homeSections: [{ id: "hero", enabled: true }],
      };
      await ctx.http
        .put(
          `${API}/admin/settings/store`,
          { ...base, brand: { ...base.brand, logoUrl: "https://example.com/logo.png" } },
          adminToken,
        )
        .expect(400);
      await ctx.http
        .put(
          `${API}/admin/settings/store`,
          { ...base, theme: { ...base.theme, gold: "gold" } },
          adminToken,
        )
        .expect(400);
      await ctx.http
        .put(
          `${API}/admin/settings/store`,
          { ...base, homeSections: [{ id: "popups", enabled: true }] },
          adminToken,
        )
        .expect(400);
    });

    it("publishes brand changes and homepage section order", async () => {
      await ctx.http
        .put(
          `${API}/admin/settings/store`,
          {
            brand: {
              name: "VRINOOR Jewels",
              tagline: "Where Elegance Meets Noor",
              description: "Test description",
              logoUrl: null,
              faviconUrl: null,
              email: "hello@example.com",
              phone: "+91 98765 43210",
              address: "Pune, India",
              socialLinks: [{ label: "Instagram", url: "https://instagram.com/vrinoor" }],
            },
            theme: { brown: "#222222", cream: "#fafafa", gold: "#c9a24a" },
            homeSections: [
              { id: "bestSellers", enabled: true },
              { id: "hero", enabled: false },
            ],
          },
          adminToken,
        )
        .expect(200);

      const res = await ctx.http.get(`${API}/store/settings`).expect(200);
      const data = (
        res.body as ApiBody<{
          brand: { name: string; socialLinks: { label: string }[] };
          theme: { brown: string };
          homeSections: { id: string; enabled: boolean }[];
        }>
      ).data;
      expect(data.brand.name).toBe("VRINOOR Jewels");
      expect(data.brand.socialLinks[0]?.label).toBe("Instagram");
      expect(data.theme.brown).toBe("#222222");
      // Saved order comes first. Sections not yet in the list are added at the end, enabled.
      expect(data.homeSections[0]).toEqual({ id: "bestSellers", enabled: true });
      expect(data.homeSections.find((s) => s.id === "hero")?.enabled).toBe(false);
      expect(data.homeSections.some((s) => s.id === "newArrivals" && s.enabled)).toBe(true);
    });
  });

  describe("banners", () => {
    it("requires a Cloudinary image and a store link", async () => {
      await ctx.http
        .post(
          `${API}/admin/banners`,
          { placement: "HOME_HERO", title: "Bad", imageUrl: "https://example.com/a.jpg" },
          adminToken,
        )
        .expect(400);
      await ctx.http
        .post(
          `${API}/admin/banners`,
          {
            placement: "HOME_HERO",
            title: "Bad link",
            imageUrl: `https://res.cloudinary.com/${cloud()}/image/upload/banner.jpg`,
            linkUrl: "javascript:alert(1)",
          },
          adminToken,
        )
        .expect(400);
    });

    it("shows only live banners on the storefront", async () => {
      const live = await ctx.http
        .post(
          `${API}/admin/banners`,
          {
            placement: "HOME_HERO",
            title: `Live ${RUN}`,
            imageUrl: `https://res.cloudinary.com/${cloud()}/image/upload/live.jpg`,
            linkUrl: "/shop",
          },
          adminToken,
        )
        .expect(201);
      bannerIds.push((live.body as ApiBody<Banner>).data.id);

      const paused = await ctx.http
        .post(
          `${API}/admin/banners`,
          {
            placement: "HOME_HERO",
            title: `Paused ${RUN}`,
            imageUrl: `https://res.cloudinary.com/${cloud()}/image/upload/paused.jpg`,
            isActive: false,
          },
          adminToken,
        )
        .expect(201);
      bannerIds.push((paused.body as ApiBody<Banner>).data.id);

      const expired = await ctx.http
        .post(
          `${API}/admin/banners`,
          {
            placement: "HOME_HERO",
            title: `Expired ${RUN}`,
            imageUrl: `https://res.cloudinary.com/${cloud()}/image/upload/expired.jpg`,
            startsAt: "2020-01-01T00:00:00.000Z",
            endsAt: "2020-02-01T00:00:00.000Z",
          },
          adminToken,
        )
        .expect(201);
      bannerIds.push((expired.body as ApiBody<Banner>).data.id);

      const res = await ctx.http.get(`${API}/banners?placement=HOME_HERO`).expect(200);
      const titles = (res.body as ApiBody<Banner[]>).data.map((banner) => banner.title);
      expect(titles).toContain(`Live ${RUN}`);
      expect(titles).not.toContain(`Paused ${RUN}`);
      expect(titles).not.toContain(`Expired ${RUN}`);
    });

    it("rejects an unknown placement on the public endpoint", async () => {
      await ctx.http.get(`${API}/banners?placement=SIDEBAR`).expect(400);
    });

    it("lets administrators edit and delete a banner", async () => {
      const id = bannerIds[0] ?? "";
      const updated = await ctx.http
        .patch(
          `${API}/admin/banners/${id}`,
          { title: `Renamed ${RUN}`, isActive: true },
          adminToken,
        )
        .expect(200);
      expect((updated.body as ApiBody<Banner>).data.title).toBe(`Renamed ${RUN}`);
      await ctx.http.delete(`${API}/admin/banners/${id}`, adminToken).expect(204);
      bannerIds.shift();
    });
  });

  describe("customers", () => {
    it("lists customers with their paid-order totals, for staff and admins only", async () => {
      await ctx.http.get(`${API}/admin/customers`, customerToken).expect(403);
      const res = await ctx.http
        .get(`${API}/admin/customers?q=settings-customer-${RUN}`, adminToken)
        .expect(200);
      const data = (
        res.body as ApiBody<{
          items: { email: string; orderCount: number; totalSpent: string }[];
          total: number;
        }>
      ).data;
      expect(data.total).toBe(1);
      expect(data.items[0]).toMatchObject({ orderCount: 0, totalSpent: "0.00" });
    });
  });
});
