import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from "class-validator";

import { MONEY_PATTERN } from "./product.dto";
import { PRODUCT_STATUSES, type ProductStatusValue } from "./product-status";

export const CATALOGUE_SORTS = ["newest", "price_asc", "price_desc", "best_selling"] as const;
export type CatalogueSort = (typeof CATALOGUE_SORTS)[number];

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/** Query string booleans arrive as text. Only the exact values "true" and "false" are accepted. */
const booleanQuery = ({ value }: { value: unknown }): unknown => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
};

export class ListProductsQueryDto {
  @ApiPropertyOptional({
    description: "Full-text search over name, SKU, material and description.",
  })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @Length(1, 100)
  q?: string;

  @ApiPropertyOptional({ description: "Category slug. Matches products assigned directly to it." })
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "category must be a slug" })
  @Length(1, 140)
  category?: string;

  @ApiPropertyOptional({ example: "5000" })
  @IsOptional()
  @Matches(MONEY_PATTERN, { message: "minPrice must be a positive amount" })
  minPrice?: string;

  @ApiPropertyOptional({ example: "25000" })
  @IsOptional()
  @Matches(MONEY_PATTERN, { message: "maxPrice must be a positive amount" })
  maxPrice?: string;

  @ApiPropertyOptional({ enum: CATALOGUE_SORTS, default: "newest" })
  @IsOptional()
  @IsIn(CATALOGUE_SORTS)
  sort?: CatalogueSort;

  @ApiPropertyOptional({ description: "Only products marked as featured (homepage section)." })
  @IsOptional()
  @Transform(booleanQuery)
  @IsIn([true, false])
  featured?: boolean;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ description: "Opaque cursor from the previous page's nextCursor." })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  cursor?: string;
}

export class ListAdminProductsQueryDto {
  @ApiPropertyOptional({ enum: PRODUCT_STATUSES })
  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: ProductStatusValue;

  @ApiPropertyOptional({ description: "Matches name or SKU, case-insensitive." })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @Length(1, 100)
  q?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
