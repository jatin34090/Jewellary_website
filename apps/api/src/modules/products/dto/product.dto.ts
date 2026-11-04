import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";

import { PRODUCT_STATUSES, type ProductStatusValue } from "./product-status";

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/** Money as a decimal string, e.g. "12999.50". Strings avoid binary floating-point rounding. */
export const MONEY_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

export class CreateProductDto {
  @ApiProperty({ example: "RG-ROSE-001", description: "Stored upper-case. Must be unique." })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z0-9][A-Z0-9-]{1,62}[A-Z0-9]$/, {
    message: "sku must be 3-64 letters, digits or hyphens",
  })
  sku!: string;

  @ApiProperty({ example: "Rose Gold Solitaire Ring", maxLength: 255 })
  @Transform(trimmed)
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiPropertyOptional({ description: "URL slug. Generated from the name when omitted." })
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "slug must be lowercase letters, digits and single hyphens",
  })
  @Length(1, 255)
  slug?: string;

  @ApiProperty({ maxLength: 10000 })
  @IsString()
  @Length(1, 10_000)
  description!: string;

  @ApiProperty({ example: "12999.00", description: "Selling price in INR." })
  @Matches(MONEY_PATTERN, { message: "price must be a positive amount with up to two decimals" })
  price!: string;

  @ApiPropertyOptional({
    example: "15999.00",
    nullable: true,
    description:
      "Original price. Shown struck through when it is higher than price. Send null to clear it.",
  })
  @IsOptional()
  @Matches(MONEY_PATTERN, {
    message: "compareAtPrice must be a positive amount with up to two decimals",
  })
  compareAtPrice?: string | null;

  @ApiPropertyOptional({ example: "3.20" })
  @IsOptional()
  @Matches(/^\d{1,4}(\.\d{1,2})?$/, { message: "weightGrams must be a positive number" })
  weightGrams?: string;

  @ApiPropertyOptional({ example: "18K rose gold" })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  material?: string;

  @ApiPropertyOptional({ enum: PRODUCT_STATUSES, default: "DRAFT" })
  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: ProductStatusValue;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ type: [String], format: "uuid", maxItems: 10 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID("all", { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ default: 0, description: "Units on hand when the product is created." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  initialStock?: number;

  @ApiPropertyOptional({
    default: 5,
    description: "Show LOW_STOCK when sellable units fall to this level.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  lowStockThreshold?: number;
}

/** Stock is changed through the inventory endpoint, so it is not part of a product update. */
export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ["initialStock", "lowStockThreshold"] as const),
) {}

export class AddProductImageDto {
  @ApiProperty({ format: "uri", description: "Cloudinary delivery URL of the image." })
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @Matches(/^https:\/\/res\.cloudinary\.com\//, { message: "url must be a Cloudinary image URL" })
  @Length(1, 500)
  url!: string;

  @ApiProperty({ description: "Provider public id, kept so the asset can be deleted later." })
  @IsString()
  @Length(1, 255)
  publicId!: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  altText?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: "Set as the main image. The first image is primary by default.",
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateProductImageDto extends PartialType(AddProductImageDto) {}

export class SetProductVideoDto {
  @ApiProperty({
    format: "uri",
    description: "Cloudinary delivery URL of the video (mp4, mov or webm).",
  })
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @Matches(/^https:\/\/res\.cloudinary\.com\/.+\/video\/upload\/.+\.(mp4|mov|webm)$/i, {
    message: "url must be a Cloudinary video URL",
  })
  @Length(1, 500)
  url!: string;

  @ApiProperty({ description: "Cloudinary public id of the video." })
  @IsString()
  @Length(1, 255)
  publicId!: string;
}
