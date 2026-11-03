import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma, type AppPrismaClient } from "@jewellery/database";

import { INTEGRATIONS } from "../../config/config.module";
import type { Integrations } from "../../config/integrations";
import { toPaise } from "../../common/money";
import { PRISMA } from "../../prisma/prisma.module";
import { ShipmentsService } from "../shipping/shipments.service";
import { verifyCheckoutSignature, verifyWebhookSignature } from "./signatures";

export type CaptureOutcome = "paid" | "already_paid" | "order_closed";

interface RazorpayPaymentEntity {
  id: string;
  order_id: string;
  amount: number;
  status?: string;
  method?: string;
  error_description?: string | null;
}

interface RazorpayWebhookEvent {
  event: string;
  payload?: { payment?: { entity?: RazorpayPaymentEntity } };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger("Payments");

  constructor(
    @Inject(PRISMA) private readonly prisma: AppPrismaClient,
    @Inject(INTEGRATIONS) private readonly integrations: Integrations,
    private readonly shipments: ShipmentsService,
  ) {}

  /** Checks the signature Razorpay Checkout returns to the browser. Only the server can trust it. */
  verifyCheckout(razorpayOrderId: string, razorpayPaymentId: string, signature: string): void {
    const secret = this.integrations.razorpay?.keySecret;
    if (!secret) {
      throw new ServiceUnavailableException("Online payments are not configured yet");
    }
    if (!verifyCheckoutSignature(secret, razorpayOrderId, razorpayPaymentId, signature)) {
      throw new BadRequestException("Payment verification failed");
    }
  }

  /**
   * Applies a captured payment to its order. Runs in one transaction, so it either moves the order
   * to PAID and turns the reserved stock into sales, or changes nothing. Calling it twice has no
   * further effect: the second call reports "already_paid".
   */
  async applyCapture(input: {
    providerOrderId: string;
    providerPaymentId: string;
    paymentStatus: "AUTHORIZED" | "CAPTURED";
    method?: string | undefined;
  }): Promise<CaptureOutcome> {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { providerOrderId: input.providerOrderId },
        include: { order: { include: { items: true } } },
      });
      if (!payment) throw new NotFoundException("Payment not found");

      const order = payment.order;
      if (payment.providerPaymentId && payment.providerPaymentId !== input.providerPaymentId) {
        throw new ConflictException("This order already has a different payment recorded");
      }

      if (order.status === "PAID") {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: input.paymentStatus === "CAPTURED" ? "CAPTURED" : payment.status,
            method: input.method ?? null,
          },
        });
        return "already_paid";
      }
      if (order.status !== "PENDING_PAYMENT") {
        return "order_closed";
      }

      // Guarded transition: only one caller can move PENDING_PAYMENT to PAID.
      const moved = await tx.order.updateMany({
        where: { id: order.id, status: "PENDING_PAYMENT" },
        data: { status: "PAID", paidAt: new Date(), reservationExpiresAt: null },
      });
      if (moved.count === 0) return "already_paid";

      // Reserved units become sold units. The guards catch any drift between reservation and sale.
      for (const item of order.items) {
        const sold = await tx.inventory.updateMany({
          where: {
            productId: item.productId,
            quantityOnHand: { gte: item.quantity },
            quantityReserved: { gte: item.quantity },
          },
          data: {
            quantityOnHand: { decrement: item.quantity },
            quantityReserved: { decrement: item.quantity },
          },
        });
        if (sold.count !== 1) {
          throw new ConflictException(
            `Stock records for ${item.name} need review before this order can be paid`,
          );
        }
        await tx.product.update({
          where: { id: item.productId },
          data: { salesCount: { increment: item.quantity } },
        });
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: input.providerPaymentId,
          status: input.paymentStatus,
          method: input.method ?? null,
          signatureVerifiedAt: new Date(),
        },
      });
      return "paid";
    });

    if (outcome === "paid") {
      // Courier booking happens after commit. A failure here is recorded and retried, and never undoes the payment.
      const orderId = await this.orderIdFor(input.providerOrderId);
      if (orderId) {
        await this.shipments.bookPaidOrder(orderId).catch((error: unknown) => {
          this.logger.error(`Courier booking failed after payment: ${String(error)}`);
        });
      }
    }
    return outcome;
  }

  /**
   * Handles one Razorpay webhook delivery. The delivery id is stored first, so a redelivered event
   * is recognised and skipped. If processing fails, the record is removed so Razorpay's retry works.
   */
  async handleWebhook(
    rawBody: Buffer,
    signature: string | undefined,
    eventId: string | undefined,
  ): Promise<"processed" | "duplicate"> {
    const secret = this.integrations.razorpay?.webhookSecret;
    if (!secret) throw new ServiceUnavailableException("Webhooks are not configured");
    if (!signature || !verifyWebhookSignature(secret, rawBody, signature)) {
      throw new BadRequestException("Invalid webhook signature");
    }
    if (!eventId || eventId.length > 100) throw new BadRequestException("Missing event id");

    let event: RazorpayWebhookEvent;
    try {
      event = JSON.parse(rawBody.toString("utf8")) as RazorpayWebhookEvent;
    } catch {
      throw new BadRequestException("Malformed webhook body");
    }

    let record: { id: string };
    try {
      record = await this.prisma.webhookEvent.create({
        data: {
          provider: "razorpay",
          eventId,
          eventType: event.event.slice(0, 100),
          payload: event as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return "duplicate";
      }
      throw error;
    }

    try {
      const entity = event.payload?.payment?.entity;
      if (event.event === "payment.captured" && entity) {
        await this.handleCaptured(entity);
      } else if (event.event === "payment.failed" && entity) {
        await this.handleFailed(entity);
      }
      await this.prisma.webhookEvent.update({
        where: { id: record.id },
        data: { processedAt: new Date() },
      });
      return "processed";
    } catch (error) {
      await this.prisma.webhookEvent.delete({ where: { id: record.id } }).catch(() => undefined);
      throw error;
    }
  }

  private async handleCaptured(entity: RazorpayPaymentEntity): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { providerOrderId: entity.order_id },
    });
    if (!payment) {
      this.logger.warn("Captured payment for an unknown order was ignored");
      return;
    }

    // Never mark an order paid for a different amount than we charged for.
    if (entity.amount !== toPaise(payment.amount)) {
      this.logger.error(`Amount mismatch on captured payment for order ${entity.order_id}`);
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", failureReason: "Captured amount did not match the order total" },
      });
      return;
    }

    await this.applyCapture({
      providerOrderId: entity.order_id,
      providerPaymentId: entity.id,
      paymentStatus: "CAPTURED",
      method: entity.method,
    });
  }

  private async handleFailed(entity: RazorpayPaymentEntity): Promise<void> {
    await this.prisma.payment.updateMany({
      where: { providerOrderId: entity.order_id, status: { in: ["CREATED", "AUTHORIZED"] } },
      data: {
        status: "FAILED",
        failureReason: (entity.error_description ?? "Payment failed").slice(0, 500),
      },
    });
  }

  private async orderIdFor(providerOrderId: string): Promise<string | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { providerOrderId },
      select: { orderId: true },
    });
    return payment?.orderId ?? null;
  }
}
