import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import type { AppPrismaClient } from "@jewellery/database";

import { INTEGRATIONS } from "../../config/config.module";
import type { Integrations } from "../../config/integrations";
import { PRISMA } from "../../prisma/prisma.module";
import { ShipmentsService } from "../shipping/shipments.service";

const BATCH_SIZE = 50;

/**
 * Background sweep, run on a timer:
 * 1. Cancels unpaid orders past their reservation and returns their stock and coupon use.
 * 2. Books paid orders with the courier, and retries bookings that failed earlier.
 * Every step is a conditional update, so overlapping runs (for example, two instances) are harmless.
 */
@Injectable()
export class OrderExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("OrderExpiry");
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(PRISMA) private readonly prisma: AppPrismaClient,
    @Inject(INTEGRATIONS) private readonly integrations: Integrations,
    private readonly shipments: ShipmentsService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.sweep();
    }, this.integrations.orderSweepIntervalMs);
    // Do not keep the process alive just for this timer (matters for tests and graceful shutdown).
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Returns the number of orders cancelled in this run. */
  async sweep(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const cancelled = await this.releaseExpiredOrders();
      await this.shipments.sweep();
      return cancelled;
    } catch (error) {
      this.logger.error(
        `Order sweep failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }

  private async releaseExpiredOrders(): Promise<number> {
    const expired = await this.prisma.order.findMany({
      where: { status: "PENDING_PAYMENT", reservationExpiresAt: { lt: new Date() } },
      include: { items: true },
      take: BATCH_SIZE,
    });

    let cancelled = 0;
    for (const order of expired) {
      const done = await this.prisma.$transaction(async (tx) => {
        const moved = await tx.order.updateMany({
          where: { id: order.id, status: "PENDING_PAYMENT" },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        });
        if (moved.count === 0) return false;

        for (const item of order.items) {
          await tx.$executeRaw`
            UPDATE "Inventory"
            SET "quantityReserved" = GREATEST("quantityReserved" - ${item.quantity}, 0)
            WHERE "productId" = ${item.productId}::uuid`;
        }
        if (order.couponId) {
          await tx.$executeRaw`
            UPDATE "Coupon"
            SET "usedCount" = GREATEST("usedCount" - 1, 0)
            WHERE "id" = ${order.couponId}::uuid`;
        }
        await tx.payment.updateMany({
          where: { orderId: order.id, status: "CREATED" },
          data: { status: "FAILED", failureReason: "Payment window expired" },
        });
        return true;
      });
      if (done) cancelled += 1;
    }

    if (cancelled > 0)
      this.logger.log(`Cancelled ${cancelled} unpaid order(s) and released their stock`);
    return cancelled;
  }
}
