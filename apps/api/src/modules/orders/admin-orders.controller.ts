import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  DefaultValuePipe,
  ParseEnumPipe,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { OrderStatus } from "@jewellery/database";

import { CurrentUser, Roles } from "../../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { CATALOGUE_ROLES } from "../../common/auth/roles.constants";
import { OrdersService, type AdminOrderFilters } from "./orders.service";
import type { OrderView } from "./order.presenter";

const ADMIN_STATUSES = ["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

class UpdateOrderStatusDto {
  @ApiProperty({ enum: ADMIN_STATUSES })
  @IsIn(ADMIN_STATUSES)
  status!: (typeof ADMIN_STATUSES)[number];
}

@ApiTags("Admin: Orders")
@ApiBearerAuth()
@Roles(...CATALOGUE_ROLES)
@Controller("admin/orders")
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @ApiOperation({ summary: "List orders, optionally filtered by status" })
  list(
    @Query("status", new ParseEnumPipe(OrderStatus, { optional: true }))
    status: OrderStatus | undefined,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    const filters: AdminOrderFilters = {
      status,
      page: Math.max(1, page),
      pageSize: Math.min(100, Math.max(1, pageSize)),
    };
    return this.orders.listForAdmin(filters);
  }

  @Get(":orderNumber")
  @ApiOperation({ summary: "One order with customer contact details" })
  get(@Param("orderNumber") orderNumber: string) {
    return this.orders.getForAdmin(orderNumber);
  }

  @Patch(":orderNumber/status")
  @ApiOperation({ summary: "Move an order to the next status" })
  changeStatus(
    @Param("orderNumber") orderNumber: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<OrderView> {
    return this.orders.changeStatus(orderNumber, dto.status, actor.id);
  }
}
