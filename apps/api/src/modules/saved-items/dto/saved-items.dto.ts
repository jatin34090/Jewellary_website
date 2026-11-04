import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

import { MAX_CART_LINES, MAX_LINE_QUANTITY } from "../../checkout/dto/checkout.dto";

export const MAX_SAVED_WISHLIST_ITEMS = 100;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class SavedBagLineDto {
  @ApiProperty({ example: "aurora-ring" })
  @IsString()
  @Matches(SLUG_PATTERN)
  slug!: string;

  @ApiProperty({ minimum: 1, maximum: MAX_LINE_QUANTITY })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity!: number;
}

/** Replaces the signed-in customer's saved bag. Sending the full list keeps the server and browser in step. */
export class ReplaceSavedBagDto {
  @ApiProperty({ type: [SavedBagLineDto] })
  @IsArray()
  @ArrayMaxSize(MAX_CART_LINES)
  @ValidateNested({ each: true })
  @Type(() => SavedBagLineDto)
  lines!: SavedBagLineDto[];
}

/** Replaces the signed-in customer's wishlist with this list of product slugs. */
export class ReplaceWishlistDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(MAX_SAVED_WISHLIST_ITEMS)
  @IsString({ each: true })
  @Matches(SLUG_PATTERN, { each: true })
  slugs!: string[];
}
