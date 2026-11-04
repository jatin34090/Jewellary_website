import "reflect-metadata";

import { createHmac, randomUUID } from "node:crypto";

import request from "supertest";
import type { Server } from "node:http";

import type { AppPrismaClient } from "@jewellery/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Fake Razorpay settings for this suite only. They are passed to createTestContext below.
const KEY_ID = "rzp_test_e2e";
const KEY_SECRET = "e2e-key-secret";
const WEBHOOK_SECRET = "e2e-webhook-secret";

import { API, createTestContext, type ApiBody, type TestContext } from "./support/app";
import type {
  PaymentGateway,
  CreateGatewayOrderInput,
  GatewayOrder,
  GatewayPayment,
  GatewayRefund,
} from "../src/modules/payments/razorpay.client";
import { OrderExpiryService } from "../src/modules/orders/order-expiry.service";

const RUN = randomUUID().slice(0, 8);
const PASSWORD = "Correct-horse-1";

/** Stands in for Razorpay in tests. It only issues ids, and never moves money. */
class FakeGateway implements PaymentGateway {
  readonly keyId = KEY_ID;
  readonly calls: CreateGatewayOrderInput[] = [];
  private readonly amounts = new Map<string, number>();
  private readonly payments = new Map<string, GatewayPayment>();
  private counter = 0;

  createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder> {
    this.calls.push(input);
    this.counter += 1;
    const id = `order_e2e${RUN}${this.counter}`;
    this.amounts.set(id, input.amountPaise);
    return Promise.resolve({ id, amount: input.amountPaise, currency: input.currency });
  }

  /** Test helper: records what Razorpay would report for a payment on this order. */
  capture(orderId: string, paymentId: string, status = "captured"): void {
    this.payments.set(paymentId, {
      id: paymentId,
      orderId,
      amount: this.amounts.get(orderId) ?? 0,
      status,
      method: "card",
    });
  }

  fetchPayment(paymentId: string): Promise<GatewayPayment> {
    const payment = this.payments.get(paymentId);
    return payment
      ? Promise.resolve(payment)
      : Promise.reject(new Error("Unknown payment in test gateway"));
  }

  refundPayment(): Promise<GatewayRefund> {
    return Promise.reject(new Error("Refunds are covered in refunds.e2e-spec.ts"));
  }

  fetchRefund(): Promise<GatewayRefund> {
    return Promise.reject(new Error("Refunds are covered in refunds.e2e-spec.ts"));
  }

  listPaymentRefunds(): Promise<GatewayRefund[]> {
    return Promise.reject(new Error("Refunds are covered in refunds.e2e-spec.ts"));
  }
}

interface OrderData {
  orderNumber: string;
  status: string;
  total: string;
  items: { productId: string; quantity: number }[];
}

interface CheckoutOrderData {
  order: OrderData;
  payment: { keyId: string; razorpayOrderId: string; amount: number; currency: string };
}

interface QuoteData {
  subtotal: string;
  discount: string;
  total: string;
  canCheckout: boolean;
  couponError: string | null;
  issues: { code: string; productId: string }[];
}

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

describe("Checkout, payments and fulfilment", () => {
  let ctx: TestContext;
  const server = (): Server => ctx.app.getHttpServer() as Server;
  let gateway: FakeGateway;
  let customerToken = "";
  let adminToken = "";
  let customerId = "";
  let addressId = "";
  let productA = "";
  let productB = "";
  let productC = "";
  let couponCode = "";
  const createdOrderNumbers: string[] = [];
  const createdProductIds: string[] = [];
  const createdCouponIds: string[] = [];

  beforeAll(async () => {
    gateway = new FakeGateway();
    ctx = await createTestContext({
      gateway,
      env: {
        RAZORPAY_KEY_ID: KEY_ID,
        RAZORPAY_KEY_SECRET: KEY_SECRET,
        RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
        ORDER_SWEEP_INTERVAL_MS: "3600000", // the suite runs the sweep itself
        ORDER_RESERVATION_MINUTES: "30",
      },
    });

    const customer = await register(`e2e-buyer-${RUN}@example.com`);
    customerToken = customer.token;
    customerId = customer.id;

    const admin = await register(`e2e-admin-checkout-${RUN}@example.com`);
    await ctx.prisma.user.update({ where: { id: admin.id }, data: { role: "ADMIN" } });
    adminToken = (
      (
        await ctx.http
          .post(`${API}/auth/login`, {
            email: `e2e-admin-checkout-${RUN}@example.com`,
            password: PASSWORD,
          })
          .expect(200)
      ).body as ApiBody<{ accessToken: string }>
    ).data.accessToken;

    productA = await createProduct(`CHK-${RUN}-A`, "Checkout Ring", "1000.00", 5);
    productB = await createProduct(`CHK-${RUN}-B`, "Checkout Band", "250.50", 2);
    productC = await createProduct(`CHK-${RUN}-C`, "Checkout Pendant", "400.00", 50);

    const address = await ctx.http
      .post(
        `${API}/addresses`,
        {
          fullName: "Asha Rao",
          phone: "+919876543210",
          line1: "12 MG Road",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
        },
        customerToken,
      )
      .expect(201);
    addressId = (address.body as ApiBody<{ id: string }>).data.id;

    couponCode = `E2E-${RUN.toUpperCase()}`;
    const coupon = await ctx.http
      .post(
        `${API}/admin/coupons`,
        {
          code: couponCode,
          discountType: "PERCENTAGE",
          discountValue: "10",
          maxDiscountAmount: "100.00",
        },
        adminToken,
      )
      .expect(201);
    createdCouponIds.push((coupon.body as ApiBody<{ id: string }>).data.id);
  });

  afterAll(async () => {
    const prisma: AppPrismaClient = ctx.prisma;
    // Remove everything this suite created: test users (and their orders, payments and shipments), products, coupons.
    const testUsers = await prisma.user.findMany({
      where: { email: { contains: RUN, endsWith: "@example.com" } },
      select: { id: true },
    });
    const userIds = testUsers.map((user) => user.id);
    await prisma.webhookEvent.deleteMany({ where: { eventId: { startsWith: `evt_${RUN}` } } });
    await prisma.payment.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.shipment.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: createdProductIds } } });
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    await prisma.coupon.deleteMany({ where: { id: { in: createdCouponIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await ctx.app.close();
  });
  async function register(email: string): Promise<{ id: string; token: string }> {
    const res = await ctx.http
      .post(`${API}/auth/register`, { email, password: PASSWORD, firstName: "E2E" })
      .expect(201);
    const data = (res.body as ApiBody<{ accessToken: string; user: { id: string } }>).data;
    return { id: data.user.id, token: data.accessToken };
  }

  async function createProduct(
    sku: string,
    name: string,
    price: string,
    stock: number,
  ): Promise<string> {
    const res = await ctx.http
      .post(
        `${API}/admin/products`,
        {
          sku,
          name,
          slug: sku.toLowerCase(),
          description: "Checkout test product",
          price,
          status: "ACTIVE",
          initialStock: stock,
        },
        adminToken,
      )
      .expect(201);
    const id = (res.body as ApiBody<{ id: string }>).data.id;
    createdProductIds.push(id);
    return id;
  }

  async function stockOf(productId: string): Promise<{ onHand: number; reserved: number }> {
    const res = await ctx.http
      .get(`${API}/admin/products/${productId}/inventory`, adminToken)
      .expect(200);
    const data = (res.body as ApiBody<{ quantityOnHand: number; quantityReserved: number }>).data;
    return { onHand: data.quantityOnHand, reserved: data.quantityReserved };
  }

  function placeOrder(
    token: string,
    items: { productId: string; quantity: number }[],
    key: string,
    coupon?: string,
  ) {
    return ctx.http
      .post(
        `${API}/checkout/orders`,
        { items, addressId, ...(coupon ? { couponCode: coupon } : {}) },
        token,
      )
      .set("Idempotency-Key", key);
  }

  describe("quote", () => {
    it("prices from the catalogue, not from anything the client sends", async () => {
      const res = await ctx.http
        .post(`${API}/checkout/quote`, {
          items: [
            { productId: productA, quantity: 2 },
            { productId: productB, quantity: 1 },
          ],
        })
        .expect(200);
      const data = (res.body as ApiBody<QuoteData>).data;
      expect(data.subtotal).toBe("2250.50");
      expect(data.total).toBe("2250.50");
      expect(data.canCheckout).toBe(true);
    });

    it("applies a valid coupon, capped at the maximum discount", async () => {
      const res = await ctx.http
        .post(`${API}/checkout/quote`, {
          items: [{ productId: productA, quantity: 5 }],
          couponCode: couponCode.toLowerCase(),
        })
        .expect(200);
      const data = (res.body as ApiBody<QuoteData>).data;
      // 10% of 5000 is 500, capped at 100.
      expect(data.discount).toBe("100.00");
      expect(data.total).toBe("4900.00");
    });

    it("reports an invalid coupon without failing the quote", async () => {
      const res = await ctx.http
        .post(`${API}/checkout/quote`, {
          items: [{ productId: productB, quantity: 1 }],
          couponCode: "NOPE-NOT-REAL",
        })
        .expect(200);
      const data = (res.body as ApiBody<QuoteData>).data;
      expect(data.couponError).toContain("not valid");
      expect(data.canCheckout).toBe(false);
    });

    it("flags stock issues and unknown products", async () => {
      const res = await ctx.http
        .post(`${API}/checkout/quote`, {
          items: [
            { productId: productB, quantity: 9 },
            { productId: randomUUID(), quantity: 1 },
          ],
        })
        .expect(200);
      const data = (res.body as ApiBody<QuoteData>).data;
      expect(data.canCheckout).toBe(false);
      expect(data.issues.map((issue) => issue.code).sort()).toEqual([
        "INSUFFICIENT_STOCK",
        "UNAVAILABLE",
      ]);
    });
  });

  describe("orders and stock reservation", () => {
    it("lets the storefront send the Idempotency-Key header across origins", async () => {
      // The browser asks permission first (preflight). Without this header allowed, checkout never reaches the API.
      const res = await request(server())
        .options(`${API}/checkout/orders`)
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "content-type,authorization,idempotency-key");
      expect(res.status).toBeLessThan(300);
      expect(res.headers["access-control-allow-headers"]?.toLowerCase()).toContain(
        "idempotency-key",
      );
    });
    it("requires sign-in and an Idempotency-Key", async () => {
      await ctx.http
        .post(`${API}/checkout/orders`, {
          items: [{ productId: productA, quantity: 1 }],
          addressId,
        })
        .expect(401);
      await placeOrder(customerToken, [{ productId: productA, quantity: 1 }], "short").expect(400);
    });

    it("creates a pending order, reserves stock, and returns the Razorpay details", async () => {
      const key = `key-${RUN}-first`;
      const res = await placeOrder(
        customerToken,
        [{ productId: productA, quantity: 2 }],
        key,
      ).expect(201);
      const data = (res.body as ApiBody<CheckoutOrderData>).data;

      expect(data.order.status).toBe("PENDING_PAYMENT");
      expect(data.order.total).toBe("2000.00");
      expect(data.payment.keyId).toBe(KEY_ID);
      expect(data.payment.amount).toBe(200000);
      expect(data.payment.currency).toBe("INR");
      createdOrderNumbers.push(data.order.orderNumber);

      expect(await stockOf(productA)).toEqual({ onHand: 5, reserved: 2 });
    });

    it("returns the same order for a repeated Idempotency-Key without a second gateway call", async () => {
      const key = `key-${RUN}-first`;
      const callsBefore = gateway.calls.length;
      const first = await placeOrder(
        customerToken,
        [{ productId: productA, quantity: 2 }],
        key,
      ).expect(201);
      expect(gateway.calls.length).toBe(callsBefore);
      expect((first.body as ApiBody<CheckoutOrderData>).data.order.status).toBe("PENDING_PAYMENT");
      expect(await stockOf(productA)).toEqual({ onHand: 5, reserved: 2 });
    });

    it("refuses an order that would exceed the stock still available", async () => {
      const res = await placeOrder(
        customerToken,
        [{ productId: productA, quantity: 4 }],
        `key-${RUN}-too-many`,
      );
      expect(res.status).toBe(409);
      expect(await stockOf(productA)).toEqual({ onHand: 5, reserved: 2 });
    });

    it("applies the coupon and counts its use", async () => {
      const key = `key-${RUN}-coupon`;
      const res = await placeOrder(
        customerToken,
        [{ productId: productA, quantity: 3 }],
        key,
        couponCode,
      ).expect(201);
      const data = (res.body as ApiBody<CheckoutOrderData>).data;
      expect(data.order.total).toBe("2900.00"); // 3000 minus the 100 cap
      createdOrderNumbers.push(data.order.orderNumber);

      const coupon = await ctx.prisma.coupon.findUnique({ where: { code: couponCode } });
      expect(coupon?.usedCount).toBe(1);
    });

    it("keeps another customer's order invisible", async () => {
      const other = await register(`e2e-other-${RUN}@example.com`);
      const mine = await ctx.http.get(`${API}/orders`, customerToken).expect(200);
      const orderNumber =
        (mine.body as ApiBody<{ orderNumber: string }[]>).data[0]?.orderNumber ?? "";
      await ctx.http.get(`${API}/orders/${orderNumber}`, other.token).expect(404);
    });
  });

  describe("payment verification", () => {
    let orderNumber = "";
    let razorpayOrderId = "";

    beforeAll(async () => {
      const res = await placeOrder(
        customerToken,
        [{ productId: productB, quantity: 1 }],
        `key-${RUN}-pay`,
      ).expect(201);
      const data = (res.body as ApiBody<CheckoutOrderData>).data;
      orderNumber = data.order.orderNumber;
      razorpayOrderId = data.payment.razorpayOrderId;
      createdOrderNumbers.push(orderNumber);
    });

    it("rejects a signature that was not made with the key secret", async () => {
      await ctx.http
        .post(
          `${API}/checkout/payments/verify`,
          {
            razorpayOrderId,
            razorpayPaymentId: "pay_forged1",
            razorpaySignature: sign("wrong-secret", `${razorpayOrderId}|pay_forged1`),
          },
          customerToken,
        )
        .expect(400);
      const order = await ctx.prisma.order.findUnique({ where: { orderNumber } });
      expect(order?.status).toBe("PENDING_PAYMENT");
    });

    it("confirms a valid payment once and turns reserved stock into a sale", async () => {
      const paymentId = `pay_e2e${RUN}`;
      gateway.capture(razorpayOrderId, paymentId);
      const before = await stockOf(productB);
      const body = {
        razorpayOrderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: sign(KEY_SECRET, `${razorpayOrderId}|${paymentId}`),
      };
      const res = await ctx.http
        .post(`${API}/checkout/payments/verify`, body, customerToken)
        .expect(200);
      expect((res.body as ApiBody<{ status: string }>).data.status).toBe("PAID");

      const after = await stockOf(productB);
      expect(after.onHand).toBe(before.onHand - 1);
      expect(after.reserved).toBe(before.reserved - 1);

      // Verifying the same payment again changes nothing.
      await ctx.http.post(`${API}/checkout/payments/verify`, body, customerToken).expect(200);
      expect(await stockOf(productB)).toEqual(after);
    });
  });

  describe("webhooks", () => {
    function webhookBody(event: string, entity: Record<string, unknown>): string {
      return JSON.stringify({ event, payload: { payment: { entity } } });
    }

    it("rejects a webhook with a bad signature", async () => {
      const body = webhookBody("payment.captured", {
        id: "pay_x",
        order_id: "order_x",
        amount: 1,
      });
      await request(server())
        .post(`${API}/webhooks/razorpay`)
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", sign("nope", body))
        .set("X-Razorpay-Event-Id", `evt_${RUN}_bad`)
        .send(body)
        .expect(400);
    });

    it("marks an order paid from a captured payment, and ignores redelivery", async () => {
      const key = `key-${RUN}-hook`;
      const placed = await placeOrder(
        customerToken,
        [{ productId: productC, quantity: 1 }],
        key,
      ).expect(201);
      const data = (placed.body as ApiBody<CheckoutOrderData>).data;
      createdOrderNumbers.push(data.order.orderNumber);

      const eventId = `evt_${RUN}_capture`;
      const body = webhookBody("payment.captured", {
        id: `pay_hook${RUN}`,
        order_id: data.payment.razorpayOrderId,
        amount: data.payment.amount,
        method: "upi",
      });
      const headers = {
        "X-Razorpay-Signature": sign(WEBHOOK_SECRET, body),
        "X-Razorpay-Event-Id": eventId,
      };

      const first = await request(server())
        .post(`${API}/webhooks/razorpay`)
        .set("Content-Type", "application/json")
        .set(headers)
        .send(body)
        .expect(200);
      expect((first.body as ApiBody<{ duplicate: boolean }>).data.duplicate).toBe(false);

      const order = await ctx.prisma.order.findUnique({
        where: { orderNumber: data.order.orderNumber },
      });
      expect(order?.status).toBe("PAID");
      const payment = await ctx.prisma.payment.findUnique({
        where: { providerOrderId: data.payment.razorpayOrderId },
      });
      expect(payment?.status).toBe("CAPTURED");

      const redelivered = await request(server())
        .post(`${API}/webhooks/razorpay`)
        .set("Content-Type", "application/json")
        .set(headers)
        .send(body)
        .expect(200);
      expect((redelivered.body as ApiBody<{ duplicate: boolean }>).data.duplicate).toBe(true);
    });

    it("does not mark an order paid when the captured amount differs from the total", async () => {
      const placed = await placeOrder(
        customerToken,
        [{ productId: productB, quantity: 1 }],
        `key-${RUN}-mismatch`,
      ).expect(201);
      const data = (placed.body as ApiBody<CheckoutOrderData>).data;
      createdOrderNumbers.push(data.order.orderNumber);

      const eventId = `evt_${RUN}_mismatch`;
      const body = webhookBody("payment.captured", {
        id: `pay_bad${RUN}`,
        order_id: data.payment.razorpayOrderId,
        amount: 100,
      });
      await request(server())
        .post(`${API}/webhooks/razorpay`)
        .set("Content-Type", "application/json")
        .set({ "X-Razorpay-Signature": sign(WEBHOOK_SECRET, body), "X-Razorpay-Event-Id": eventId })
        .send(body)
        .expect(200);

      const order = await ctx.prisma.order.findUnique({
        where: { orderNumber: data.order.orderNumber },
      });
      expect(order?.status).toBe("PENDING_PAYMENT");
      const payment = await ctx.prisma.payment.findUnique({
        where: { providerOrderId: data.payment.razorpayOrderId },
      });
      expect(payment?.status).toBe("FAILED");
    });
  });

  describe("expiry", () => {
    it("cancels an unpaid order past its reservation and releases stock and coupon use", async () => {
      const before = await stockOf(productC);
      const coupon = await ctx.prisma.coupon.findUnique({ where: { code: couponCode } });
      const placed = await placeOrder(
        customerToken,
        [{ productId: productC, quantity: 1 }],
        `key-${RUN}-expire`,
        couponCode,
      ).expect(201);
      const data = (placed.body as ApiBody<CheckoutOrderData>).data;
      createdOrderNumbers.push(data.order.orderNumber);
      expect(await stockOf(productC)).toEqual({
        onHand: before.onHand,
        reserved: before.reserved + 1,
      });

      await ctx.prisma.order.update({
        where: { orderNumber: data.order.orderNumber },
        data: { reservationExpiresAt: new Date(Date.now() - 60_000) },
      });
      const cancelled = await ctx.app.get(OrderExpiryService).sweep();
      expect(cancelled).toBeGreaterThanOrEqual(1);

      const order = await ctx.prisma.order.findUnique({
        where: { orderNumber: data.order.orderNumber },
      });
      expect(order?.status).toBe("CANCELLED");
      expect(await stockOf(productC)).toEqual(before);
      const couponAfter = await ctx.prisma.coupon.findUnique({ where: { code: couponCode } });
      expect(couponAfter?.usedCount).toBe(coupon?.usedCount);
    });
  });

  describe("admin order handling", () => {
    it("moves a paid order through fulfilment and rejects an invalid jump", async () => {
      const paid = await ctx.prisma.order.findFirst({
        where: { userId: customerId, status: "PAID" },
        orderBy: { createdAt: "desc" },
      });
      expect(paid).not.toBeNull();
      const number = paid?.orderNumber ?? "";

      await ctx.http
        .patch(`${API}/admin/orders/${number}/status`, { status: "DELIVERED" }, adminToken)
        .expect(409); // a paid order must be shipped before it is delivered

      await ctx.http
        .patch(`${API}/admin/orders/${number}/status`, { status: "PROCESSING" }, adminToken)
        .expect(200);
      const shipped = await ctx.http
        .patch(`${API}/admin/orders/${number}/status`, { status: "SHIPPED" }, adminToken)
        .expect(200);
      expect((shipped.body as ApiBody<{ status: string }>).data.status).toBe("SHIPPED");
    });

    it("lists orders for staff with filters", async () => {
      const res = await ctx.http
        .get(`${API}/admin/orders?status=PENDING_PAYMENT&pageSize=5`, adminToken)
        .expect(200);
      const data = (res.body as ApiBody<{ items: { status: string }[]; total: number }>).data;
      expect(data.items.every((order) => order.status === "PENDING_PAYMENT")).toBe(true);
    });
  });

  describe("addresses", () => {
    it("validates the PIN code and keeps exactly one default", async () => {
      await ctx.http
        .post(
          `${API}/addresses`,
          {
            fullName: "Bad Pin",
            phone: "+919876543210",
            line1: "1 Street",
            city: "Pune",
            state: "MH",
            postalCode: "012345",
          },
          customerToken,
        )
        .expect(400);

      const created = await ctx.http
        .post(
          `${API}/addresses`,
          {
            fullName: "Second Home",
            phone: "+919876543210",
            line1: "9 Lake View",
            city: "Pune",
            state: "Maharashtra",
            postalCode: "411001",
            isDefault: true,
          },
          customerToken,
        )
        .expect(201);
      const newId = (created.body as ApiBody<{ id: string }>).data.id;

      const list = await ctx.http.get(`${API}/addresses`, customerToken).expect(200);
      const defaults = (list.body as ApiBody<{ isDefault: boolean }[]>).data.filter(
        (a) => a.isDefault,
      );
      expect(defaults).toHaveLength(1);

      await ctx.http.delete(`${API}/addresses/${newId}`, customerToken).expect(204);
    });
  });
});
