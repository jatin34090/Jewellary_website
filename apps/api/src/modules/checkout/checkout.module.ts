import { Module } from "@nestjs/common";

import { INTEGRATIONS } from "../../config/config.module";
import type { Integrations } from "../../config/integrations";
import { AddressesModule } from "../addresses/addresses.module";
import { CouponsModule } from "../coupons/coupons.module";
import { PAYMENT_GATEWAY, gatewayFrom } from "../payments/razorpay.client";
import { PaymentsService } from "../payments/payments.service";
import { ShippingModule } from "../shipping/shipping.module";
import { SettingsModule } from "../settings/settings.module";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";
import { PricingService } from "./pricing.service";
import { WebhooksController } from "../payments/webhooks.controller";

@Module({
  imports: [AddressesModule, CouponsModule, SettingsModule, ShippingModule],
  controllers: [CheckoutController, WebhooksController],
  providers: [
    CheckoutService,
    PricingService,
    PaymentsService,
    {
      provide: PAYMENT_GATEWAY,
      inject: [INTEGRATIONS],
      useFactory: (integrations: Integrations) => gatewayFrom(integrations),
    },
  ],
  exports: [PricingService, PaymentsService, PAYMENT_GATEWAY],
})
export class CheckoutModule {}
