import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, Length, Matches } from "class-validator";

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

export class CreateAddressDto {
  @ApiPropertyOptional({ example: "Home", maxLength: 50 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @Length(1, 50)
  label?: string;

  @ApiProperty({ example: "Asha Rao", maxLength: 150 })
  @Transform(trimmed)
  @IsString()
  @Length(2, 150)
  fullName!: string;

  @ApiProperty({ example: "+919876543210" })
  @Transform(trimmed)
  @Matches(/^\+?[0-9]{10,15}$/, { message: "phone must be 10 to 15 digits" })
  phone!: string;

  @ApiProperty({ example: "12, MG Road", maxLength: 255 })
  @Transform(trimmed)
  @IsString()
  @Length(5, 255)
  line1!: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @Length(0, 255)
  line2?: string;

  @ApiProperty({ example: "Bengaluru", maxLength: 100 })
  @Transform(trimmed)
  @IsString()
  @Length(2, 100)
  city!: string;

  @ApiProperty({ example: "Karnataka", maxLength: 100 })
  @Transform(trimmed)
  @IsString()
  @Length(2, 100)
  state!: string;

  @ApiProperty({ example: "560001", description: "6-digit Indian PIN code." })
  @Transform(trimmed)
  @Matches(/^[1-9][0-9]{5}$/, { message: "postalCode must be a valid 6-digit PIN code" })
  postalCode!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}

export class AddressDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  label!: string | null;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  line1!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  line2!: string | null;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  state!: string;

  @ApiProperty()
  postalCode!: string;

  @ApiProperty({ example: "IN" })
  country!: string;

  @ApiProperty()
  isDefault!: boolean;
}
