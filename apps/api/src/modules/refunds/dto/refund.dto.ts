import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, Length, Matches } from "class-validator";

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

export class CreateRefundDto {
  @ApiPropertyOptional({
    example: "500.00",
    description: "Amount in INR. Leave empty to refund everything still refundable.",
  })
  @IsOptional()
  @Matches(/^\d{1,8}(\.\d{1,2})?$/, {
    message: "amount must be a positive amount with up to two decimals",
  })
  amount?: string;

  @ApiProperty({ example: "Customer returned the item", minLength: 3, maxLength: 255 })
  @Transform(trimmed)
  @IsString()
  @Length(3, 255)
  reason!: string;
}
