import {
  Controller,
  Get,
  Inject,
  Module,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AppPrismaClient, Prisma } from "@jewellery/database";

import { Roles } from "../../common/auth/auth.decorators";
import { CATALOGUE_ROLES } from "../../common/auth/roles.constants";
import { moneyString } from "../../common/money";
import { PRISMA } from "../../prisma/prisma.module";

const REVENUE_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export interface CustomerRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  createdAt: Date;
  isActive: boolean;
  orderCount: number;
  totalSpent: string;
}

@ApiTags("Admin: Customers")
@ApiBearerAuth()
@Roles(...CATALOGUE_ROLES)
@Controller("admin/customers")
export class AdminCustomersController {
  constructor(@Inject(PRISMA) private readonly prisma: AppPrismaClient) {}

  @Get()
  @ApiOperation({ summary: "Customers with order count and total spent (paid orders only)" })
  async list(
    @Query("q") q: string | undefined,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ): Promise<{ items: CustomerRow[]; page: number; pageSize: number; total: number }> {
    const size = Math.min(100, Math.max(1, pageSize));
    const current = Math.max(1, page);
    const term = q?.trim();

    const where: Prisma.UserWhereInput = {
      role: "CUSTOMER",
      deletedAt: null,
      ...(term
        ? {
            OR: [
              { email: { contains: term.toLowerCase() } },
              { firstName: { contains: term, mode: "insensitive" } },
              { lastName: { contains: term, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (current - 1) * size,
        take: size,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          createdAt: true,
          isActive: true,
        },
      }),
    ]);

    // One grouped query for the whole page, rather than one query per customer.
    const stats = await this.prisma.order.groupBy({
      by: ["userId"],
      where: {
        userId: { in: users.map((user) => user.id) },
        status: { in: [...REVENUE_STATUSES] },
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });
    const byUser = new Map(stats.map((row) => [row.userId, row]));

    const items: CustomerRow[] = users.map((user) => {
      const row = byUser.get(user.id);
      return {
        ...user,
        orderCount: row?._count._all ?? 0,
        totalSpent: moneyString(row?._sum.totalAmount ?? 0),
      };
    });

    return { items, page: current, pageSize: size, total };
  }
}

@Module({
  controllers: [AdminCustomersController],
})
export class CustomersModule {}
