import { Body, Controller, Get, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser, Public, Roles } from "../../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { ADMIN_ONLY } from "../../common/auth/roles.constants";
import { CheckoutSettingsDto, StoreSettingsDto } from "./dto/settings.dto";
import { StoreSettingsService, type StoreSettingsView } from "./store-settings.service";

@ApiTags("Admin: Settings")
@ApiBearerAuth()
@Roles(...ADMIN_ONLY)
@Controller("admin/settings")
export class AdminSettingsController {
  constructor(private readonly settings: StoreSettingsService) {}

  @Get("checkout")
  @ApiOperation({ summary: "Shipping and tax rules" })
  getCheckout(): Promise<CheckoutSettingsDto> {
    return this.settings.getCheckoutSettings();
  }

  @Put("checkout")
  @ApiOperation({ summary: "Update shipping and tax rules. Applies to the next quote." })
  putCheckout(
    @Body() dto: CheckoutSettingsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<CheckoutSettingsDto> {
    return this.settings.updateCheckoutSettings(dto, actor.id);
  }

  @Get("store")
  @ApiOperation({ summary: "Brand, theme and homepage sections" })
  getStore(): Promise<StoreSettingsView> {
    return this.settings.getStoreSettings();
  }

  @Put("store")
  @ApiOperation({ summary: "Update brand, theme colours, contact details and homepage sections" })
  putStore(
    @Body() dto: StoreSettingsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<StoreSettingsView> {
    return this.settings.updateStoreSettings(dto, actor.id);
  }
}

@ApiTags("Store")
@Controller("store")
export class PublicStoreController {
  constructor(private readonly settings: StoreSettingsService) {}

  /** Brand, theme and homepage layout for the storefront. Contains nothing private. */
  @Public()
  @Get("settings")
  @ApiOperation({ summary: "Public store settings: brand, theme and homepage sections" })
  get(): Promise<StoreSettingsView> {
    return this.settings.getStoreSettings();
  }
}
