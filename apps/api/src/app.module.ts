import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { ConfigModule } from "./config/config.module";
import { JwtAuthGuard } from "./common/auth/jwt-auth.guard";
import { RolesGuard } from "./common/auth/roles.guard";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ResponseInterceptor } from "./common/response/response.interceptor";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AddressesModule } from "./modules/addresses/addresses.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { CheckoutModule } from "./modules/checkout/checkout.module";
import { CouponsModule } from "./modules/coupons/coupons.module";
import { DashboardModule } from "./modules/dashboard/dashboard.controller";
import { HealthModule } from "./modules/health/health.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { ProductsModule } from "./modules/products/products.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { UploadsModule } from "./modules/uploads/uploads.controller";
import { UsersModule } from "./modules/users/users.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    // Default limit for every route. Auth routes set stricter limits with @Throttle().
    // Counters are in memory for now; they move to Redis in Phase 7 so limits hold across instances.
    ThrottlerModule.forRoot({
      throttlers: [{ name: "default", ttl: 60_000, limit: 120 }],
    }),
    JwtModule.register({}),
    HealthModule,
    AuditModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ProductsModule,
    AddressesModule,
    CouponsModule,
    SettingsModule,
    CheckoutModule,
    OrdersModule,
    UploadsModule,
    DashboardModule,
  ],
  providers: [
    // Guards run in this order: rate limit, then authentication, then authorisation.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
