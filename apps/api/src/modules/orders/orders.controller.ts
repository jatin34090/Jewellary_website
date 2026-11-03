import { Controller, Get, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { OrdersService } from "./orders.service";
import type { OrderView } from "./order.presenter";

@ApiTags("Orders")
@ApiBearerAuth()
@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @ApiOperation({ summary: "The signed-in customer's orders, newest first" })
  list(@CurrentUser() user: AuthenticatedUser): Promise<OrderView[]> {
    return this.orders.listForUser(user.id);
  }

  @Get(":orderNumber")
  @ApiOperation({ summary: "One order with items, status and tracking" })
  get(
    @Param("orderNumber") orderNumber: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrderView> {
    return this.orders.getForUser(user.id, orderNumber);
  }
}
