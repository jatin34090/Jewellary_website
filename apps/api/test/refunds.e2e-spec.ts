import "reflect-metadata";

import { randomUUID } from "node:crypto";

import { ServiceUnavailableException } from "@nestjs/common";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestContext, API, type ApiBody, type TestContext } from "./support/app";
import {
  RefundRejectedError,
  type CreateGatewayOrderInput,
  type GatewayOrder,
  type GatewayPayment,
  type GatewayRefund,
  type PaymentGateway,
  type RefundPaymentInput,
} from "../src/modules/payments/razorpay.client";

// Unique per run. Every record and account this suite creates carries it, so cleanup removes only those.
const RUN = randomUUID().slice(0, 8);
const PASSWORD = "Correct-horse-1";

/** How the next refund request is answered by the fake provider. */
type CreateOutcome =
  | "accepted" // the provider accepted the refund and reports the status in nextStatus
  | "rejected" // the provider refused it outright (4xx)
  | "lost"; // the provider accepted it, but our response was lost (timeout)

/** Stands in for Razorpay. It records every call and keeps the refunds it has accepted. */
class RecordingGateway implements PaymentGateway {
  readonly keyId = "rzp_test_recording";
  readonly refunds: RefundPaymentInput[] = [];
  nextOutcome: CreateOutcome = "accepted";
  nextStatus = "processed";
  /** Makes the next accepted refund disagree with the request, to test the safety checks. */
  nextMismatch: "none" | "amount" | "payment" = "none";
  private readonly provider = new Map<string, GatewayRefund>();
  private counter = 0;

  createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder> {
    return Promise.resolve({
      id: `order_${RUN}_${input.receipt}`,
      amount: input.amountPaise,
      currency: input.currency,
    });
  }

  fetchPayment(): Promise<GatewayPayment> {
    return Promise.reject(new Error("Not used by refund tests"));
  }

  refundPayment(input: RefundPaymentInput): Promise<GatewayRefund> {
    this.refunds.push(input);
    const outcome = this.nextOutcome;
    this.nextOutcome = "accepted";
    if (outcome === "rejected") {
      return Promise.reject(
        new RefundRejectedError("The refund amount is more than the captured amount"),
      );
    }
    this.counter += 1;
    const status = this.nextStatus;
    this.nextStatus = "processed";
    const mismatch = this.nextMismatch;
    this.nextMismatch = "none";
    const record: GatewayRefund = {
      id: `rfnd_${RUN}_${this.counter}`,
      amount: mismatch === "amount" ? input.amountPaise + 100 : input.amountPaise,
      status,
      paymentId: mismatch === "payment" ? "pay_someone_else" : input.providerPaymentId,
      receipt: input.receipt,
    };
    this.provider.set(record.id, record);
    if (outcome === "lost") {
      return Promise.reject(new ServiceUnavailableException("The refund outcome is unknown."));
    }
    return Promise.resolve(record);
  }

  fetchRefund(providerRefundId: string): Promise<GatewayRefund> {
    const record = this.provider.get(providerRefundId);
    return record ? Promise.resolve(record) : Promise.reject(new Error("Unknown refund"));
  }

  listPaymentRefunds(providerPaymentId: string): Promise<GatewayRefund[]> {
    return Promise.resolve(
      [...this.provider.values()].filter((record) => record.paymentId === providerPaymentId),
    );
  }

  /** Test helper: Razorpay changes the status of a refund it already holds. */
  setProviderStatus(providerRefundId: string, status: string): void {
    const record = this.provider.get(providerRefundId);
    if (!record) throw new Error("Unknown refund in test");
    this.provider.set(providerRefundId, { ...record, status });
  }
}

interface SummaryBody {
  paid: string;
  refunded: string;
  refundable: string;
  orderStatus: string;
  refunds: { id: string; status: string; amount: string; providerRefundId: string | null }[];
}

interface RefundBody {
  id: string;
  status: string;
  amount: string;
  providerRefundId: string | null;
  failureReason: string | null;
}

describe("Refunds API", () => {
  let ctx: TestContext;
  let gateway: RecordingGateway;
  let adminToken = "";
  let staffToken = "";
  let customerToken = "";
  const orderIds: string[] = [];
  const actorIds: string[] = [];
  const customerEmail = `e2e-${RUN}-refund-customer@example.com`;

  beforeAll(async () => {
    gateway = new RecordingGateway();
    ctx = await createTestContext({ gateway });
    adminToken = await signIn(ctx, "ADMIN", actorIds);
    staffToken = await signIn(ctx, "STAFF", actorIds);
    customerToken = await signIn(ctx, "CUSTOMER", actorIds);
  });

  beforeEach(() => {
    gateway.refunds.length = 0;
    gateway.nextOutcome = "accepted";
    gateway.nextStatus = "processed";
    gateway.nextMismatch = "none";
  });

  afterAll(async () => {
    const orderKeys = orderIds;
    await ctx.prisma.auditLog.deleteMany({ where: { entityId: { in: orderKeys } } });
    await ctx.prisma.refund.deleteMany({ where: { orderId: { in: orderKeys } } });
    await ctx.prisma.payment.deleteMany({ where: { orderId: { in: orderKeys } } });
    await ctx.prisma.order.deleteMany({ where: { id: { in: orderKeys } } });
    await ctx.prisma.auditLog.deleteMany({ where: { actorId: { in: actorIds } } });
    await ctx.prisma.user.deleteMany({
      where: { email: { contains: RUN, endsWith: "@example.com" } },
    });
    await ctx.prisma.$disconnect();
    await ctx.app.close();
  });

  /** Creates a paid (or unpaid) order with one captured payment of 1000.00, owned by this run. */
  async function paidOrder(
    label: string,
    status: "PAID" | "CANCELLED" | "PENDING_PAYMENT" = "PAID",
  ): Promise<string> {
    const user = await ctx.prisma.user
      .findUnique({ where: { email: customerEmail }, select: { id: true } })
      .then(
        (found) =>
          found ??
          ctx.prisma.user.create({
            data: { email: customerEmail, passwordHash: "not-used", firstName: "Refund" },
            select: { id: true },
          }),
      );
    const orderNumber = `RF${RUN}${label}`.slice(0, 20);
    const order = await ctx.prisma.order.create({
      data: {
        orderNumber,
        userId: user.id,
        status,
        subtotal: "1000.00",
        totalAmount: "1000.00",
        shippingAddress: { fullName: "Test" },
        paidAt: status === "PENDING_PAYMENT" ? null : new Date(),
        payments: {
          create: {
            providerOrderId: `order_ref_${RUN}_${label}`,
            providerPaymentId: `pay_ref_${RUN}_${label}`,
            amount: "1000.00",
            status: status === "PENDING_PAYMENT" ? "CREATED" : "CAPTURED",
          },
        },
      },
    });
    orderIds.push(order.id);
    return orderNumber;
  }

  async function paymentOf(orderNumber: string) {
    return ctx.prisma.payment.findFirstOrThrow({ where: { order: { orderNumber } } });
  }

  async function refundRowsOf(orderNumber: string) {
    return ctx.prisma.refund.findMany({ where: { order: { orderNumber } } });
  }

  function issue(orderNumber: string, body: Record<string, unknown>, token = adminToken) {
    return ctx.http.post(`${API}/admin/orders/${orderNumber}/refunds`, body, token);
  }

  function summaryOf(orderNumber: string, token = adminToken) {
    return ctx.http.get(`${API}/admin/orders/${orderNumber}/refunds`, token);
  }

  function refresh(orderNumber: string, refundId: string, token = adminToken) {
    return ctx.http.post(
      `${API}/admin/orders/${orderNumber}/refunds/${refundId}/refresh`,
      {},
      token,
    );
  }

  describe("permissions", () => {
    it("rejects anonymous callers on every refund route", async () => {
      const number = await paidOrder("anon");
      await ctx.http.get(`${API}/admin/orders/${number}/refunds`).expect(401);
      await ctx.http.post(`${API}/admin/orders/${number}/refunds`, { reason: "Anon" }).expect(401);
      await refresh(number, randomUUID(), "").expect(401);
      expect(gateway.refunds).toHaveLength(0);
    });

    it("keeps refunds away from customers on every refund route", async () => {
      const number = await paidOrder("cust");
      await summaryOf(number, customerToken).expect(403);
      await issue(number, { reason: "Customer tries" }, customerToken).expect(403);
      await refresh(number, randomUUID(), customerToken).expect(403);
      expect(gateway.refunds).toHaveLength(0);
    });

    it("lets staff read the refund history but never issue or refresh", async () => {
      const number = await paidOrder("staff");
      const read = await summaryOf(number, staffToken).expect(200);
      expect((read.body as ApiBody<SummaryBody>).data.refundable).toBe("1000.00");

      await issue(number, { reason: "Staff tries" }, staffToken).expect(403);
      await refresh(number, randomUUID(), staffToken).expect(403);
      expect(gateway.refunds).toHaveLength(0);
    });
  });

  describe("issuing refunds", () => {
    it("shows what was paid and what is still refundable", async () => {
      const number = await paidOrder("summary");
      const res = await summaryOf(number).expect(200);
      expect((res.body as ApiBody<SummaryBody>).data).toMatchObject({
        paid: "1000.00",
        refunded: "0.00",
        refundable: "1000.00",
      });
    });

    it("refunds part, sends the right payment and receipt, writes an audit entry and keeps the payment captured", async () => {
      const number = await paidOrder("partial");
      const res = await issue(number, { amount: "400.00", reason: "Damaged clasp" }).expect(201);
      const refund = (res.body as ApiBody<RefundBody>).data;
      expect(refund.status).toBe("PROCESSED");

      const payment = await paymentOf(number);
      expect(gateway.refunds).toHaveLength(1);
      expect(gateway.refunds[0]).toMatchObject({
        providerPaymentId: payment.providerPaymentId,
        amountPaise: 40000,
        receipt: refund.id,
      });

      const audit = await ctx.prisma.auditLog.findFirst({
        where: { action: "order.refunded", changes: { path: ["refundId"], equals: refund.id } },
      });
      expect(audit).not.toBeNull();

      const summary = await summaryOf(number).expect(200);
      expect((summary.body as ApiBody<SummaryBody>).data).toMatchObject({
        refunded: "400.00",
        refundable: "600.00",
        orderStatus: "PAID",
      });
      const after = await paymentOf(number);
      expect(after.status).toBe("CAPTURED");
    });

    it("refuses more than the remaining amount and creates no refund record", async () => {
      const number = await paidOrder("over");
      const before = (await refundRowsOf(number)).length;
      await issue(number, { amount: "1000.01", reason: "Too much" }).expect(400);
      expect(gateway.refunds).toHaveLength(0);
      expect((await refundRowsOf(number)).length).toBe(before);
    });

    it("refunds the rest in two parts, closes the order and blocks further refunds", async () => {
      const number = await paidOrder("full");
      await issue(number, { amount: "250.00", reason: "First part" }).expect(201);
      await issue(number, { reason: "Rest of order" }).expect(201);

      expect(gateway.refunds.map((refund) => refund.amountPaise)).toEqual([25000, 75000]);
      const order = await ctx.prisma.order.findUniqueOrThrow({ where: { orderNumber: number } });
      expect(order.status).toBe("REFUNDED");
      expect((await paymentOf(number)).status).toBe("REFUNDED");

      await issue(number, { reason: "Again" }).expect(409);
    });

    it("accepts an explicit full amount equal to the remaining balance", async () => {
      const number = await paidOrder("exact");
      const res = await issue(number, { amount: "1000.00", reason: "Full cancellation" }).expect(
        201,
      );
      expect((res.body as ApiBody<RefundBody>).data.amount).toBe("1000.00");
      const order = await ctx.prisma.order.findUniqueOrThrow({ where: { orderNumber: number } });
      expect(order.status).toBe("REFUNDED");
    });

    it("refunds a cancelled order that was paid", async () => {
      const number = await paidOrder("cancel", "CANCELLED");
      await issue(number, { reason: "Cancelled after payment" }).expect(201);
      const order = await ctx.prisma.order.findUniqueOrThrow({ where: { orderNumber: number } });
      expect(order.status).toBe("REFUNDED");
    });

    it("records a rejected refund as failed, leaves the refundable amount unchanged, and allows a retry", async () => {
      const number = await paidOrder("retry");
      gateway.nextOutcome = "rejected";
      await issue(number, { amount: "100.00", reason: "Provider says no" }).expect(400);

      const summary = await summaryOf(number).expect(200);
      const body = (summary.body as ApiBody<SummaryBody>).data;
      expect(body.refundable).toBe("1000.00");
      expect(body.refunds[0]).toMatchObject({ status: "FAILED", amount: "100.00" });

      const retry = await issue(number, { amount: "100.00", reason: "Second attempt" }).expect(201);
      expect((retry.body as ApiBody<RefundBody>).data.status).toBe("PROCESSED");
      const after = await summaryOf(number).expect(200);
      expect((after.body as ApiBody<SummaryBody>).data.refundable).toBe("900.00");
    });

    it("lets exactly one of two concurrent full-refund requests through", async () => {
      const number = await paidOrder("race");
      const [first, second] = await Promise.all([
        issue(number, { reason: "Double click one" }),
        issue(number, { reason: "Double click two" }),
      ]);
      expect([first.status, second.status].sort()).toEqual([201, 409]);
      expect(gateway.refunds).toHaveLength(1);
      const rows = await refundRowsOf(number);
      expect(rows.filter((row) => row.status === "PROCESSED")).toHaveLength(1);
    });
  });

  describe("gateway status handling", () => {
    it("marks a refund failed when Razorpay reports failure in its first answer, and gives the amount back", async () => {
      const number = await paidOrder("failnow");
      gateway.nextStatus = "failed";
      const res = await issue(number, { reason: "Rejected by the bank" }).expect(201);
      expect((res.body as ApiBody<RefundBody>).data.status).toBe("FAILED");
      const summary = await summaryOf(number).expect(200);
      expect((summary.body as ApiBody<SummaryBody>).data.refundable).toBe("1000.00");
      const order = await ctx.prisma.order.findUniqueOrThrow({ where: { orderNumber: number } });
      expect(order.status).toBe("PAID");
    });

    it("keeps a pending refund pending, does not close the order, and blocks a second refund", async () => {
      const number = await paidOrder("pending");
      gateway.nextStatus = "pending";
      const res = await issue(number, { reason: "Bank still processing" }).expect(201);
      const refund = (res.body as ApiBody<RefundBody>).data;
      expect(refund.status).toBe("PENDING");
      expect(refund.providerRefundId).not.toBeNull();

      const order = await ctx.prisma.order.findUniqueOrThrow({ where: { orderNumber: number } });
      expect(order.status).toBe("PAID");
      expect((await paymentOf(number)).status).toBe("CAPTURED");

      await issue(number, { reason: "While pending" }).expect(409);
      expect(gateway.refunds).toHaveLength(1);
    });

    it("moves a pending refund to processed on refresh, and then closes the order", async () => {
      const number = await paidOrder("settle");
      gateway.nextStatus = "pending";
      const created = (await issue(number, { reason: "Settles later" }).expect(201))
        .body as ApiBody<RefundBody>;

      gateway.setProviderStatus(created.data.providerRefundId ?? "", "processed");
      const res = await refresh(number, created.data.id).expect(201);
      expect((res.body as ApiBody<RefundBody>).data.status).toBe("PROCESSED");

      const order = await ctx.prisma.order.findUniqueOrThrow({ where: { orderNumber: number } });
      expect(order.status).toBe("REFUNDED");
    });

    it("marks a pending refund failed on refresh and gives the amount back", async () => {
      const number = await paidOrder("failsoon");
      gateway.nextStatus = "pending";
      const created = (await issue(number, { reason: "Will fail" }).expect(201))
        .body as ApiBody<RefundBody>;

      gateway.setProviderStatus(created.data.providerRefundId ?? "", "failed");
      const res = await refresh(number, created.data.id).expect(201);
      expect((res.body as ApiBody<RefundBody>).data.status).toBe("FAILED");
      const after = await summaryOf(number).expect(200);
      expect((after.body as ApiBody<SummaryBody>).data.refundable).toBe("1000.00");
    });

    it("keeps a pending refund pending when refresh still finds it pending", async () => {
      const number = await paidOrder("stillpending");
      gateway.nextStatus = "pending";
      const created = (await issue(number, { reason: "Still waiting" }).expect(201))
        .body as ApiBody<RefundBody>;
      const res = await refresh(number, created.data.id).expect(201);
      expect((res.body as ApiBody<RefundBody>).data.status).toBe("PENDING");
    });

    it("never marks a refund processed for an unexpected Razorpay status", async () => {
      const number = await paidOrder("weird");
      gateway.nextStatus = "something-new";
      const res = await issue(number, { reason: "Unexpected status" }).expect(201);
      expect((res.body as ApiBody<RefundBody>).data.status).toBe("PENDING");
      const order = await ctx.prisma.order.findUniqueOrThrow({ where: { orderNumber: number } });
      expect(order.status).toBe("PAID");
    });

    it("keeps the refund pending when Razorpay reports a different amount", async () => {
      const number = await paidOrder("amountmismatch");
      gateway.nextMismatch = "amount";
      const res = await issue(number, { reason: "Amount differs" }).expect(201);
      expect((res.body as ApiBody<RefundBody>).data.status).toBe("PENDING");
      const order = await ctx.prisma.order.findUniqueOrThrow({ where: { orderNumber: number } });
      expect(order.status).toBe("PAID");
    });

    it("keeps the refund pending when Razorpay reports a different payment", async () => {
      const number = await paidOrder("paymismatch");
      gateway.nextMismatch = "payment";
      const res = await issue(number, { reason: "Payment differs" }).expect(201);
      expect((res.body as ApiBody<RefundBody>).data.status).toBe("PENDING");
      const order = await ctx.prisma.order.findUniqueOrThrow({ where: { orderNumber: number } });
      expect(order.status).toBe("PAID");
    });

    it("finds a refund whose response was lost, by its receipt, and settles it on refresh", async () => {
      const number = await paidOrder("lost");
      gateway.nextOutcome = "lost";
      await issue(number, { reason: "Response lost" }).expect(503);

      const rows = await refundRowsOf(number);
      expect(rows[0]).toMatchObject({ status: "PENDING", providerRefundId: null });

      const res = await refresh(number, rows[0]?.id ?? "").expect(201);
      expect((res.body as ApiBody<RefundBody>).data.status).toBe("PROCESSED");
      const order = await ctx.prisma.order.findUniqueOrThrow({ where: { orderNumber: number } });
      expect(order.status).toBe("REFUNDED");
    });

    it("says so when Razorpay has no record of a lost refund", async () => {
      const number = await paidOrder("norecord");
      gateway.nextOutcome = "rejected";
      await issue(number, { reason: "Rejected first" }).expect(400);
      // A refund row that was never sent to the provider: the lookup by receipt finds nothing.
      const pending = await ctx.prisma.refund.create({
        data: {
          orderId: (await ctx.prisma.order.findUniqueOrThrow({ where: { orderNumber: number } }))
            .id,
          paymentId: (await paymentOf(number)).id,
          amount: "50.00",
          reason: "Never reached Razorpay",
          status: "PENDING",
          createdById: actorIds[0] ?? "",
        },
      });
      const res = await refresh(number, pending.id).expect(409);
      expect((res.body as ApiBody<unknown>).error?.message).toContain("no record");
    });

    it("does not refresh a refund that belongs to another order", async () => {
      const first = await paidOrder("own");
      const second = await paidOrder("other");
      gateway.nextStatus = "pending";
      const created = (await issue(first, { reason: "Belongs to first" }).expect(201))
        .body as ApiBody<RefundBody>;
      await refresh(second, created.data.id).expect(404);
    });

    it("rejects a refresh with a malformed refund id", async () => {
      const number = await paidOrder("badid");
      await refresh(number, "not-a-uuid").expect(400);
    });
  });

  describe("validation", () => {
    it.each([
      ["zero", "0"],
      ["negative", "-1"],
      ["letters", "abc"],
      ["three decimals", "10.005"],
      ["empty", ""],
    ])("rejects an invalid amount (%s)", async (label, amount) => {
      const number = await paidOrder(`amt${label.replace(/\W/g, "").slice(0, 5)}`);
      await issue(number, { amount, reason: "Bad amount" }).expect(400);
      expect(gateway.refunds).toHaveLength(0);
    });

    it("rejects a reason shorter than three characters", async () => {
      const number = await paidOrder("shortreason");
      await issue(number, { reason: "ab" }).expect(400);
      expect(gateway.refunds).toHaveLength(0);
    });

    it("rejects a reason longer than 255 characters", async () => {
      const number = await paidOrder("longreason");
      await issue(number, { reason: "x".repeat(256) }).expect(400);
      expect(gateway.refunds).toHaveLength(0);
    });

    it("rejects a reason that is only spaces", async () => {
      const number = await paidOrder("spacesreason");
      await issue(number, { reason: "    " }).expect(400);
      expect(gateway.refunds).toHaveLength(0);
    });

    it("returns 404 for an unknown order number, on both the summary and the refund", async () => {
      await summaryOf("NO-SUCH-ORDER").expect(404);
      await issue("NO-SUCH-ORDER", { reason: "Nobody" }).expect(404);
    });

    it("does not refund an order that was never paid", async () => {
      const number = await paidOrder("unpaid", "PENDING_PAYMENT");
      await issue(number, { reason: "Not paid" }).expect(409);
      expect(gateway.refunds).toHaveLength(0);
    });
  });

  describe("database integrity", () => {
    it("refuses a refund whose payment belongs to a different order", async () => {
      const orderA = await paidOrder("fkA");
      const orderB = await paidOrder("fkB");
      const a = await ctx.prisma.order.findUniqueOrThrow({ where: { orderNumber: orderA } });
      const paymentB = await paymentOf(orderB);

      await expect(
        ctx.prisma.refund.create({
          data: {
            orderId: a.id,
            paymentId: paymentB.id,
            amount: "10.00",
            reason: "Mismatched on purpose",
            status: "PENDING",
            createdById: actorIds[0] ?? "",
          },
        }),
      ).rejects.toThrow();
    });
  });
});

async function signIn(
  ctx: TestContext,
  role: "CUSTOMER" | "STAFF" | "ADMIN",
  actorIds: string[],
): Promise<string> {
  // Kept short: email addresses allow at most 64 characters before the @.
  const email = `e2e-${RUN}-refund-${role.toLowerCase()}-${randomUUID().slice(0, 12)}@example.com`;
  const register = await ctx.http.post(`${API}/auth/register`, {
    email,
    password: PASSWORD,
    firstName: "Test",
  });
  if (register.status !== 201) {
    // Report the server's reason, not just the status code, so a setup failure can be diagnosed.
    throw new Error(
      `Registration failed for a ${role} test account: ${JSON.stringify(register.body)}`,
    );
  }
  if (role === "CUSTOMER") {
    return (register.body as ApiBody<{ accessToken: string }>).data.accessToken;
  }
  const user = await ctx.prisma.user.update({
    where: { email },
    data: { role },
    select: { id: true },
  });
  actorIds.push(user.id);
  const login = await ctx.http.post(`${API}/auth/login`, { email, password: PASSWORD }).expect(200);
  return (login.body as ApiBody<{ accessToken: string }>).data.accessToken;
}
