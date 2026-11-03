import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export const MAX_CART_LINES = 30;
export const MAX_LINE_QUANTITY = 10;

export class CheckoutItemDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  productId!: string;

  @ApiProperty({ minimum: 1, maximum: MAX_LINE_QUANTITY })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity!: number;
}

export class CheckoutQuoteDto {
  @ApiProperty({ type: [CheckoutItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_CART_LINES)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @ApiPropertyOptional({ example: "WELCOME10" })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  couponCode?: string;
}

export class CreateCheckoutOrderDto extends CheckoutQuoteDto {
  @ApiProperty({ format: "uuid", description: "Saved address to ship to." })
  @IsUUID()
  addressId!: string;
}

export class VerifyPaymentDto {
  @ApiProperty({ example: "order_Nf8k2" })
  @IsString()
  @Matches(/^order_[A-Za-z0-9]+$/)
  razorpayOrderId!: string;

  @ApiProperty({ example: "pay_Nf8k3" })
  @IsString()
  @Matches(/^pay_[A-Za-z0-9]+$/)
  razorpayPaymentId!: string;

  @ApiProperty({ description: "HMAC-SHA256 signature returned by Razorpay Checkout." })
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  razorpaySignature!: string;
}

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
