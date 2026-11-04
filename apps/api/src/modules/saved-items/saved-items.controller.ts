import { Body, Controller, Get, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { ReplaceSavedBagDto, ReplaceWishlistDto } from "./dto/saved-items.dto";
import type { SavedBagLine } from "./saved-items.service";
import { SavedItemsService } from "./saved-items.service";

@ApiTags("Saved items")
@ApiBearerAuth()
@Controller("account")
export class SavedItemsController {
  constructor(private readonly savedItems: SavedItemsService) {}

  @Get("bag")
  @ApiOperation({ summary: "Get the signed-in customer's saved bag" })
  getBag(@CurrentUser() user: AuthenticatedUser): Promise<SavedBagLine[]> {
    return this.savedItems.getBag(user.id);
  }

  @Put("bag")
  @ApiOperation({ summary: "Replace the saved bag with this list of lines" })
  replaceBag(
    @Body() dto: ReplaceSavedBagDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SavedBagLine[]> {
    return this.savedItems.replaceBag(user.id, dto);
  }

  @Get("wishlist")
  @ApiOperation({ summary: "Get the signed-in customer's wishlist (product slugs)" })
  getWishlist(@CurrentUser() user: AuthenticatedUser): Promise<string[]> {
    return this.savedItems.getWishlist(user.id);
  }

  @Put("wishlist")
  @ApiOperation({ summary: "Replace the wishlist with this list of product slugs" })
  replaceWishlist(
    @Body() dto: ReplaceWishlistDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<string[]> {
    return this.savedItems.replaceWishlist(user.id, dto);
  }
}
