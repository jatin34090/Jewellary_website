import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type AppPrismaClient, type Refund } from "@jewellery/database";

import { moneyString } from "../../common/money";
import { PRISMA } from "../../prisma/prisma.module";
import { AuditService } from "../audit/audit.service";
import {
  PAYMENT_GATEWAY,
  RefundRejectedError,
  type GatewayRefund,
  type PaymentGateway,
} from "../payments/razorpay.client";
import type { CreateRefundDto } from "./dto/refund.dto";

/** Orders that can have money returned. Pending payments have nothing to refund. */
const REFUNDABLE_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

export interface RefundView {
  id: string;
  amount: string;
  reason: string;
  status: "PENDING" | "PROCESSED" | "FAILED";
  providerRefundId: string | null;
  failureReason: string | null;
  createdAt: Date;
}

export interface RefundSummary {
  orderNumber: string;
  orderStatus: string;
  paid: string;
  refunded: string;
  refundable: string;
  refunds: RefundView[];
}

@Injectable()
export class RefundsService {
  private readonly logger = new Logger("Refunds");

  constructor(
    @Inject(PRISMA) private readonly prisma: AppPrismaClient,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly audit: AuditService,
  ) {}

  async summary(orderNumber: string): Promise<RefundSummary> {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        payments: { where: { status: { in: ["AUTHORIZED", "CAPTURED"] } } },
        refunds: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!order) throw new NotFoundException("Order not found");

    const paid = order.payments.reduce((sum, p) => sum.plus(p.amount), new Prisma.Decimal(0));
    const counted = order.refunds
      .filter((refund) => refund.status !== "FAILED")
      .reduce((sum, refund) => sum.plus(refund.amount), new Prisma.Decimal(0));
    const refunded = order.refunds
      .filter((refund) => refund.status === "PROCESSED")
      .reduce((sum, refund) => sum.plus(refund.amount), new Prisma.Decimal(0));
    const remaining = Prisma.Decimal.max(paid.minus(counted), 0);

    return {
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      paid: moneyString(paid),
      refunded: moneyString(refunded),
      refundable: moneyString(remaining),
      refunds: order.refunds.map(presentRefund),
    };
  }

  /**
   * Refunds part or all of a captured payment. The refund is recorded as PENDING before Razorpay is
   * called, so the amount already promised counts against the limit while the call is in flight.
   * A definite rejection marks it FAILED. Any other outcome leaves it PENDING until a refresh.
   * No new refund can start on a payment while one of its refunds is still pending.
   */
  async create(orderNumber: string, dto: CreateRefundDto, actorId: string): Promise<RefundView> {
    const pending = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { orderNumber },
        select: { id: true, status: true },
      });
      if (!order) throw new NotFoundException("Order not found");

      const payment = await tx.payment.findFirst({
        where: {
          orderId: order.id,
          status: { in: ["AUTHORIZED", "CAPTURED"] },
          providerPaymentId: { not: null },
        },
        orderBy: { createdAt: "desc" },
      });
      if (!payment?.providerPaymentId) {
        throw new ConflictException("This order has no captured payment to refund");
      }
      // Lock the payment row so two refunds cannot both see the same remaining amount.
      await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${payment.id}::uuid FOR UPDATE`;

      if (!(REFUNDABLE_STATUSES as readonly string[]).includes(order.status)) {
        throw new ConflictException(`A ${order.status} order cannot be refunded`);
      }

      const open = await tx.refund.findFirst({
        where: { paymentId: payment.id, status: "PENDING" },
        select: { id: true },
      });
      if (open) {
        throw new ConflictException(
          "A refund is still pending with Razorpay. Refresh its status before issuing another.",
        );
      }

      const existing = await tx.refund.aggregate({
        where: { paymentId: payment.id, status: { not: "FAILED" } },
        _sum: { amount: true },
      });
      const remaining = payment.amount.minus(existing._sum.amount ?? 0);
      if (remaining.lte(0)) {
        throw new ConflictException("This order has already been refunded in full");
      }

      const amount = dto.amount ? new Prisma.Decimal(dto.amount) : remaining;
      if (amount.lte(0)) {
        throw new BadRequestException("Refund amount must be more than zero");
      }
      if (amount.gt(remaining)) {
        throw new BadRequestException(
          `Refund amount is more than the ${moneyString(remaining)} still refundable`,
        );
      }

      const refund = await tx.refund.create({
        data: {
          paymentId: payment.id,
          orderId: order.id,
          amount,
          reason: dto.reason,
          status: "PENDING",
          createdById: actorId,
        },
      });
      return { refund, providerPaymentId: payment.providerPaymentId, orderId: order.id };
    });

    const { refund, providerPaymentId, orderId } = pending;
    const amountPaise = toPaise(refund.amount);
    try {
      const gatewayRefund = await this.gateway.refundPayment({
        providerPaymentId,
        amountPaise,
        receipt: refund.id,
        notes: { orderNumber, reason: refund.reason.slice(0, 200) },
      });
      const updated = await this.applyGatewayRefund(
        refund.id,
        orderId,
        actorId,
        { providerPaymentId, amountPaise },
        gatewayRefund,
      );
      return presentRefund(updated);
    } catch (error: unknown) {
      if (error instanceof RefundRejectedError) {
        await this.finish(refund.id, orderId, actorId, {
          status: "FAILED",
          failureReason: error.message.slice(0, 500),
        });
        throw new BadRequestException(error.message);
      }
      // Unknown outcome: the refund stays PENDING. It is never retried automatically.
      this.logger.error(`Refund ${refund.id} outcome unknown: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Asks Razorpay for the current state of a pending refund. The refund is looked up by its
   * provider id when we have it, or by our receipt when the first response was lost.
   */
  async refresh(orderNumber: string, refundId: string, actorId: string): Promise<RefundView> {
    const refund = await this.prisma.refund.findFirst({
      where: { id: refundId, order: { orderNumber } },
      include: { payment: { select: { providerPaymentId: true } } },
    });
    if (!refund) throw new NotFoundException("Refund not found");
    if (refund.status !== "PENDING") return presentRefund(refund);

    const providerPaymentId = refund.payment.providerPaymentId;
    if (!providerPaymentId) {
      throw new ConflictException("This refund has no payment reference to check");
    }
    const gatewayRefund = refund.providerRefundId
      ? await this.gateway.fetchRefund(refund.providerRefundId)
      : (await this.gateway.listPaymentRefunds(providerPaymentId)).find(
          (candidate) => candidate.receipt === refund.id,
        );
    if (!gatewayRefund) {
      throw new ConflictException("Razorpay has no record of this refund yet. Try again later.");
    }

    const updated = await this.applyGatewayRefund(
      refund.id,
      refund.orderId,
      actorId,
      { providerPaymentId, amountPaise: toPaise(refund.amount) },
      gatewayRefund,
    );
    return presentRefund(updated);
  }

  /**
   * Turns Razorpay's answer into our state. Only "processed" counts as money returned, and only
   * then can the order close. "failed" is final. "pending" waits for a refresh. Any other status,
   * or a different amount or payment, leaves the refund pending and is logged for review.
   */
  private async applyGatewayRefund(
    refundId: string,
    orderId: string,
    actorId: string,
    expected: { providerPaymentId: string; amountPaise: number },
    gatewayRefund: GatewayRefund,
  ): Promise<Refund> {
    if (
      gatewayRefund.amount !== expected.amountPaise ||
      gatewayRefund.paymentId !== expected.providerPaymentId
    ) {
      this.logger.error(`Refund ${refundId}: Razorpay reported a different amount or payment`);
      return this.recordProviderId(refundId, gatewayRefund.id);
    }
    switch (gatewayRefund.status) {
      case "processed":
        return this.finish(refundId, orderId, actorId, {
          status: "PROCESSED",
          providerRefundId: gatewayRefund.id,
        });
      case "failed":
        return this.finish(refundId, orderId, actorId, {
          status: "FAILED",
          providerRefundId: gatewayRefund.id,
          failureReason: "Razorpay reported that the refund failed.",
        });
      case "pending":
        return this.recordProviderId(refundId, gatewayRefund.id);
      default:
        this.logger.error(`Refund ${refundId}: unexpected Razorpay status, left pending`);
        return this.recordProviderId(refundId, gatewayRefund.id);
    }
  }

  private async recordProviderId(refundId: string, providerRefundId: string): Promise<Refund> {
    return this.prisma.refund.update({
      where: { id: refundId },
      data: { providerRefundId },
    });
  }

  private async finish(
    refundId: string,
    orderId: string,
    actorId: string,
    result: {
      status: "PROCESSED" | "FAILED";
      providerRefundId?: string;
      failureReason?: string;
    },
  ): Promise<Refund> {
    return this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.update({
        where: { id: refundId },
        data: {
          status: result.status,
          providerRefundId: result.providerRefundId ?? null,
          failureReason: result.failureReason ?? null,
        },
      });

      if (result.status === "PROCESSED") {
        const payment = await tx.payment.findUniqueOrThrow({
          where: { id: refund.paymentId },
          select: { id: true, amount: true },
        });
        const processedTotal = await tx.refund.aggregate({
          where: { paymentId: payment.id, status: "PROCESSED" },
          _sum: { amount: true },
        });
        if ((processedTotal._sum.amount ?? new Prisma.Decimal(0)).gte(payment.amount)) {
          // Full refund, confirmed by Razorpay: the payment and the order both close.
          await tx.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
          await tx.order.update({ where: { id: orderId }, data: { status: "REFUNDED" } });
        }
      }

      await this.audit.record(
        {
          actorId,
          action: result.status === "PROCESSED" ? "order.refunded" : "order.refund_failed",
          entityType: "Order",
          entityId: orderId,
          changes: {
            refundId,
            amount: moneyString(refund.amount),
            status: result.status,
          } satisfies Prisma.InputJsonObject,
        },
        tx,
      );
      return refund;
    });
  }
}

/** Razorpay takes amounts in paise, as integers. */
function toPaise(amount: Prisma.Decimal): number {
  return new Prisma.Decimal(amount).mul(100).toNumber();
}

function presentRefund(refund: {
  id: string;
  amount: Prisma.Decimal;
  reason: string;
  status: "PENDING" | "PROCESSED" | "FAILED";
  providerRefundId: string | null;
  failureReason: string | null;
  createdAt: Date;
}): RefundView {
  return {
    id: refund.id,
    amount: moneyString(refund.amount),
    reason: refund.reason,
    status: refund.status,
    providerRefundId: refund.providerRefundId,
    failureReason: refund.failureReason,
    createdAt: refund.createdAt,
  };
}
