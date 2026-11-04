import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { CheckoutModule } from "../checkout/checkout.module";
import { RefundsController } from "./refunds.controller";
import { RefundsService } from "./refunds.service";

@Module({
  imports: [AuditModule, CheckoutModule],
  controllers: [RefundsController],
  providers: [RefundsService],
})
export class RefundsModule {}
