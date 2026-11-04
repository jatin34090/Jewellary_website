import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser, Roles } from "../../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { ADMIN_ONLY, CATALOGUE_ROLES } from "../../common/auth/roles.constants";
import { CreateRefundDto } from "./dto/refund.dto";
import { RefundsService, type RefundSummary, type RefundView } from "./refunds.service";

/**
 * Who may do what:
 * - Admin: view refund history, issue refunds, refresh pending refunds.
 * - Staff: view refund history only.
 * - Customers: no access. The guards reject them before these handlers run.
 */
@ApiTags("Admin: Refunds")
@ApiBearerAuth()
@Controller("admin/orders/:orderNumber/refunds")
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Get()
  @Roles(...CATALOGUE_ROLES)
  @ApiOperation({ summary: "Refund history and the amounts paid, refunded and still refundable" })
  summary(@Param("orderNumber") orderNumber: string): Promise<RefundSummary> {
    return this.refunds.summary(orderNumber);
  }

  @Post()
  @Roles(...ADMIN_ONLY)
  @ApiOperation({ summary: "Refund all or part of a paid order through Razorpay (admin only)" })
  create(
    @Param("orderNumber") orderNumber: string,
    @Body() dto: CreateRefundDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<RefundView> {
    return this.refunds.create(orderNumber, dto, actor.id);
  }

  @Post(":refundId/refresh")
  @Roles(...ADMIN_ONLY)
  @ApiOperation({
    summary: "Check a pending refund with Razorpay and update its status (admin only)",
  })
  refresh(
    @Param("orderNumber") orderNumber: string,
    @Param("refundId", ParseUUIDPipe) refundId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<RefundView> {
    return this.refunds.refresh(orderNumber, refundId, actor.id);
  }
}
