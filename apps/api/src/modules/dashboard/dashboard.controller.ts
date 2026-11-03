import { Controller, Get, Inject, Module } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Prisma, type AppPrismaClient } from "@jewellery/database";

import { Roles } from "../../common/auth/auth.decorators";
import { CATALOGUE_ROLES } from "../../common/auth/roles.constants";
import { moneyString } from "../../common/money";
import { PRISMA } from "../../prisma/prisma.module";
import { presentOrder } from "../orders/order.presenter";

const REVENUE_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export interface DashboardView {
  products: Record<string, number>;
  last30Days: { orders: number; revenue: string };
  pendingPayments: number;
  lowStock: { productId: string; name: string; sku: string; sellable: number; threshold: number }[];
  recentOrders: ReturnType<typeof presentOrder>[];
}

@ApiTags("Admin: Dashboard")
@ApiBearerAuth()
@Roles(...CATALOGUE_ROLES)
@Controller("admin/dashboard")
export class DashboardController {
  constructor(@Inject(PRISMA) private readonly prisma: AppPrismaClient) {}

  @Get()
  @ApiOperation({
    summary: "Store overview: product counts, 30-day sales, low stock and recent orders",
  })
  async overview(): Promise<DashboardView> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const revenueWhere: Prisma.OrderWhereInput = {
      status: { in: [...REVENUE_STATUSES] },
      paidAt: { gte: since },
    };

    const [statusGroups, orderCount, revenue, pendingPayments, lowStock, recent] =
      await Promise.all([
        this.prisma.product.groupBy({
          by: ["status"],
          where: { deletedAt: null },
          _count: { _all: true },
        }),
        this.prisma.order.count({ where: revenueWhere }),
        this.prisma.order.aggregate({ where: revenueWhere, _sum: { totalAmount: true } }),
        this.prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
        this.prisma.$queryRaw<
          { productId: string; name: string; sku: string; sellable: number; threshold: number }[]
        >`
        SELECT p.id AS "productId", p.name, p.sku,
               (i."quantityOnHand" - i."quantityReserved")::int AS sellable,
               i."lowStockThreshold"::int AS threshold
        FROM "Inventory" i
        JOIN "Product" p ON p.id = i."productId"
        WHERE p."deletedAt" IS NULL
          AND p.status = 'ACTIVE'
          AND (i."quantityOnHand" - i."quantityReserved") <= i."lowStockThreshold"
        ORDER BY sellable ASC
        LIMIT 10`,
        this.prisma.order.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { items: true, shipments: true },
        }),
      ]);

    return {
      products: Object.fromEntries(statusGroups.map((group) => [group.status, group._count._all])),
      last30Days: {
        orders: orderCount,
        revenue: moneyString(revenue._sum.totalAmount ?? 0),
      },
      pendingPayments,
      lowStock,
      recentOrders: recent.map(presentOrder),
    };
  }
}

@Module({
  controllers: [DashboardController],
})
export class DashboardModule {}
