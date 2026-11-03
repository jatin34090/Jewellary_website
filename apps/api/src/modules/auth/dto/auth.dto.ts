import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

import { PublicUserDto } from "../../users/dto/public-user.dto";

const normaliseEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({ example: "asha@example.com", maxLength: 255 })
  @Transform(normaliseEmail)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    description: "At least 8 characters, including a letter and a digit.",
  })
  @IsString()
  @Length(8, 128)
  @Matches(/[A-Za-z]/, { message: "password must contain at least one letter" })
  @Matches(/\d/, { message: "password must contain at least one digit" })
  password!: string;

  @ApiProperty({ example: "Asha", maxLength: 100 })
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @ApiPropertyOptional({ example: "Rao", maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @ApiPropertyOptional({ example: "+919876543210" })
  @IsOptional()
  @Matches(/^\+?[0-9]{10,15}$/, {
    message: "phone must be 10 to 15 digits, optionally starting with +",
  })
  phone?: string;
}

export class LoginDto {
  @ApiProperty({ example: "asha@example.com" })
  @Transform(normaliseEmail)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  // Upper bound prevents very long inputs from making the memory-hard hash expensive.
  @ApiProperty({ maxLength: 128 })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: "Short-lived bearer token for the Authorization header." })
  accessToken!: string;

  @ApiProperty({ example: "Bearer" })
  tokenType!: string;

  @ApiProperty({ description: "Access token lifetime in seconds." })
  expiresIn!: number;

  @ApiProperty({ type: PublicUserDto })
  user!: PublicUserDto;
}
