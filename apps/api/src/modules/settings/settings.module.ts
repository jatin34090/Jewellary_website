import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { AdminSettingsController, PublicStoreController } from "./settings.controller";
import { StoreSettingsService } from "./store-settings.service";

@Module({
  imports: [AuditModule],
  controllers: [AdminSettingsController, PublicStoreController],
  providers: [StoreSettingsService],
  exports: [StoreSettingsService],
})
export class SettingsModule {}
