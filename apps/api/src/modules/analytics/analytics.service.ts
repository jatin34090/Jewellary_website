import { Inject, Injectable } from "@nestjs/common";
import { Prisma, type AppPrismaClient } from "@jewellery/database";

import { moneyString } from "../../common/money";
import { PRISMA } from "../../prisma/prisma.module";

/** Orders that count as sales. Pending, cancelled and refunded orders are left out. */
export const SALES_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

/** Store day boundaries follow India time, the same timezone as the order numbers. */
const STORE_TIME_ZONE = "Asia/Kolkata";
const TOP_PRODUCT_LIMIT = 8;

export interface AnalyticsView {
  range: { from: string; to: string; days: number };
  totals: { orders: number; revenue: string; averageOrderValue: string; unitsSold: number };
  daily: { date: string; orders: number; revenue: string }[];
  topProducts: {
    productId: string;
    name: string;
    sku: string;
    slug: string;
    unitsSold: number;
    revenue: string;
  }[];
  statusCounts: Record<string, number>;
}

@Injectable()
export class AnalyticsService {
  constructor(@Inject(PRISMA) private readonly prisma: AppPrismaClient) {}

  /**
   * Sales for the last `days` store days, counting today. Revenue and orders use the paid time,
   * so an order placed yesterday and paid today counts today. Status counts use the created time.
   */
  async overview(days: number, now: Date = new Date()): Promise<AnalyticsView> {
    const to = storeDate(now);
    const from = shiftDays(to, -(days - 1));
    const since = new Date(`${from}T00:00:00+05:30`);
    const until = new Date(`${to}T23:59:59.999+05:30`);

    const salesWhere: Prisma.OrderWhereInput = {
      status: { in: [...SALES_STATUSES] },
      paidAt: { gte: since, lte: until },
    };

    const [dailyRows, topGroups, statusGroups, unitsSold] = await Promise.all([
      this.prisma.$queryRaw<{ day: string; orders: number; revenue: string }[]>`
        SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
               COUNT(o.id)::int AS orders,
               COALESCE(SUM(o."totalAmount"), 0)::text AS revenue
        FROM generate_series(${from}::date, ${to}::date, interval '1 day') AS d(day)
        LEFT JOIN "Order" o
          ON o."paidAt" IS NOT NULL
         AND (o."paidAt" AT TIME ZONE ${STORE_TIME_ZONE})::date = d.day::date
         AND o.status IN (${Prisma.join([...SALES_STATUSES])})
        GROUP BY d.day
        ORDER BY d.day`,
      this.prisma.orderItem.groupBy({
        by: ["productId"],
        where: { order: salesWhere },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { lineTotal: "desc" } },
        take: TOP_PRODUCT_LIMIT,
      }),
      this.prisma.order.groupBy({
        by: ["status"],
        where: { createdAt: { gte: since, lte: until } },
        _count: { _all: true },
      }),
      this.prisma.orderItem.aggregate({
        where: { order: salesWhere },
        _sum: { quantity: true },
      }),
    ]);

    const products = await this.prisma.product.findMany({
      where: { id: { in: topGroups.map((group) => group.productId) } },
      select: { id: true, name: true, sku: true, slug: true },
    });
    const productById = new Map(products.map((product) => [product.id, product]));

    const orders = dailyRows.reduce((total, row) => total + row.orders, 0);
    const revenue = dailyRows.reduce(
      (total, row) => total.plus(new Prisma.Decimal(row.revenue)),
      new Prisma.Decimal(0),
    );

    return {
      range: { from, to, days },
      totals: {
        orders,
        revenue: moneyString(revenue),
        averageOrderValue: moneyString(orders > 0 ? revenue.div(orders) : 0),
        unitsSold: unitsSold._sum.quantity ?? 0,
      },
      daily: dailyRows.map((row) => ({ date: row.day, orders: row.orders, revenue: row.revenue })),
      topProducts: topGroups.flatMap((group) => {
        const product = productById.get(group.productId);
        if (!product) return [];
        return [
          {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            slug: product.slug,
            unitsSold: group._sum.quantity ?? 0,
            revenue: moneyString(group._sum.lineTotal ?? 0),
          },
        ];
      }),
      statusCounts: Object.fromEntries(
        statusGroups.map((group) => [group.status, group._count._all]),
      ),
    };
  }
}

/** Today's date in India time as YYYY-MM-DD. */
function storeDate(now: Date): string {
  return now.toLocaleDateString("en-CA", { timeZone: STORE_TIME_ZONE });
}

function shiftDays(date: string, delta: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + delta);
  return shifted.toISOString().slice(0, 10);
}
