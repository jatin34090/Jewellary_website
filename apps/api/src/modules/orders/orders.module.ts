import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { ShippingModule } from "../shipping/shipping.module";
import { AdminOrdersController } from "./admin-orders.controller";
import { OrderExpiryService } from "./order-expiry.service";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [AuditModule, ShippingModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, OrderExpiryService],
  exports: [OrdersService],
})
export class OrdersModule {}
