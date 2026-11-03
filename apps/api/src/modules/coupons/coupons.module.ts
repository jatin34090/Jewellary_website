import { Controller, Get, Post, Patch, Param, ParseUUIDPipe, Body } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Module } from "@nestjs/common";
import type { Coupon } from "@jewellery/database";

import { CurrentUser, Roles } from "../../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { ADMIN_ONLY } from "../../common/auth/roles.constants";
import { AuditModule } from "../audit/audit.module";
import { CouponsService } from "./coupons.service";
import { CreateCouponDto, UpdateCouponDto } from "./dto/coupon.dto";

@ApiTags("Admin: Coupons")
@ApiBearerAuth()
@Roles(...ADMIN_ONLY)
@Controller("admin/coupons")
export class AdminCouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  list(): Promise<Coupon[]> {
    return this.coupons.list();
  }

  @Post()
  create(@Body() dto: CreateCouponDto, @CurrentUser() actor: AuthenticatedUser): Promise<Coupon> {
    return this.coupons.create(dto, actor.id);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Coupon> {
    return this.coupons.update(id, dto, actor.id);
  }
}

@Module({
  imports: [AuditModule],
  controllers: [AdminCouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
