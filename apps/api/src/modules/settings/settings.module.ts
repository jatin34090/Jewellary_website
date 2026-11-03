import { Module } from "@nestjs/common";

import { StoreSettingsService } from "./store-settings.service";

@Module({
  providers: [StoreSettingsService],
  exports: [StoreSettingsService],
})
export class SettingsModule {}
