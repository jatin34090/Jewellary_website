import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type AppPrismaClient, type OrderStatus } from "@jewellery/database";

import { PRISMA } from "../../prisma/prisma.module";
import { AuditService } from "../audit/audit.service";
import { presentOrder, type OrderView } from "./order.presenter";

const ORDER_INCLUDE = { items: true, shipments: true } as const;

/** Admin status changes that are allowed. Money is returned through the refunds endpoint, not here. */
const ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PAID: ["PROCESSING", "SHIPPED", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
};

export interface AdminOrderFilters {
  status?: OrderStatus | undefined;
  page: number;
  pageSize: number;
}

@Injectable()
export class OrdersService {
  constructor(
    @Inject(PRISMA) private readonly prisma: AppPrismaClient,
    private readonly audit: AuditService,
  ) {}

  async listForUser(userId: string): Promise<OrderView[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return orders.map(presentOrder);
  }

  async getForUser(userId: string, orderNumber: string): Promise<OrderView> {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber, userId },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException("Order not found");
    return presentOrder(order);
  }

  async listForAdmin(
    filters: AdminOrderFilters,
  ): Promise<{ items: OrderView[]; page: number; pageSize: number; total: number }> {
    const where: Prisma.OrderWhereInput = filters.status ? { status: filters.status } : {};
    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
    ]);
    return {
      items: orders.map(presentOrder),
      page: filters.page,
      pageSize: filters.pageSize,
      total,
    };
  }

  async getForAdmin(
    orderNumber: string,
  ): Promise<OrderView & { customer: { email: string; firstName: string } }> {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { ...ORDER_INCLUDE, user: { select: { email: true, firstName: true } } },
    });
    if (!order) throw new NotFoundException("Order not found");
    return { ...presentOrder(order), customer: order.user };
  }

  async changeStatus(orderNumber: string, next: OrderStatus, actorId: string): Promise<OrderView> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { orderNumber }, include: ORDER_INCLUDE });
      if (!order) throw new NotFoundException("Order not found");

      const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
      if (!allowed.includes(next)) {
        throw new ConflictException(`An order cannot move from ${order.status} to ${next}`);
      }
      if (next === "CANCELLED") {
        // Cancelling a paid order returns its stock to sellable levels. It does not refund the payment.
        for (const item of order.items) {
          await tx.inventory.update({
            where: { productId: item.productId },
            data: { quantityOnHand: { increment: item.quantity } },
          });
        }
      }

      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: next,
          ...(next === "CANCELLED" ? { cancelledAt: new Date() } : {}),
        },
        include: ORDER_INCLUDE,
      });
      await this.audit.record(
        {
          actorId,
          action: "order.status_changed",
          entityType: "Order",
          entityId: order.id,
          changes: { from: order.status, to: next } satisfies Prisma.InputJsonObject,
        },
        tx,
      );
      return presentOrder(updated);
    });
  }
}
