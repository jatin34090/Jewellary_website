import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";

import { MONEY_PATTERN } from "../../products/dto/product.dto";

export const DISCOUNT_TYPES = ["PERCENTAGE", "FIXED_AMOUNT"] as const;

export class CreateCouponDto {
  @ApiProperty({ example: "WELCOME10", description: "Stored upper-case." })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z0-9][A-Z0-9_-]{2,38}[A-Z0-9]$/, {
    message: "code must be 4-40 letters, digits, hyphens or underscores",
  })
  code!: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string;

  @ApiProperty({ enum: DISCOUNT_TYPES })
  @IsIn(DISCOUNT_TYPES)
  discountType!: (typeof DISCOUNT_TYPES)[number];

  @ApiProperty({ example: "10", description: "Percentage (0-100) or a fixed amount in INR." })
  @Matches(MONEY_PATTERN, { message: "discountValue must be a positive amount" })
  discountValue!: string;

  @ApiPropertyOptional({ description: "Upper limit for percentage discounts." })
  @IsOptional()
  @Matches(MONEY_PATTERN)
  maxDiscountAmount?: string;

  @ApiPropertyOptional({ default: "0" })
  @IsOptional()
  @Matches(MONEY_PATTERN)
  minOrderAmount?: string;

  @ApiPropertyOptional({ description: "Total number of times the coupon can be used." })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(1_000_000)
  usageLimit?: number;

  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}
