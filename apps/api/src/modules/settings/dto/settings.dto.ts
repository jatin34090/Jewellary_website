import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  ValidateIf,
  ValidateNested,
} from "class-validator";

import { MONEY_PATTERN } from "../../products/dto/product.dto";
import { HOME_SECTION_IDS, type StoreSettingsView } from "../store-settings.service";

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;
const CLOUDINARY_IMAGE = /^https:\/\/res\.cloudinary\.com\/.+\/image\/upload\/.+$/;

export class CheckoutSettingsDto {
  @ApiProperty({
    example: "99.00",
    description: "Shipping charged below the free-shipping threshold, in INR.",
  })
  @Matches(MONEY_PATTERN, { message: "flatRate must be an amount such as 99 or 99.50" })
  flatRate!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: "2999.00",
    description: "Orders at or above this subtotal ship free. Send null for no threshold.",
  })
  @IsOptional()
  @Matches(MONEY_PATTERN, {
    message: "freeShippingAbove must be an amount such as 2999 or 2999.00",
  })
  freeShippingAbove?: string | null;

  @ApiProperty({
    example: "3",
    description: "Tax as a percentage of the discounted subtotal (0-100).",
  })
  @Matches(/^\d{1,3}(\.\d{1,2})?$/, { message: "taxPercent must be a percentage such as 3 or 18" })
  taxPercent!: string;
}

export class HomeSectionDto {
  @ApiProperty({ enum: HOME_SECTION_IDS })
  @IsIn(HOME_SECTION_IDS)
  id!: (typeof HOME_SECTION_IDS)[number];

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class SocialLinkDto {
  @ApiProperty({ example: "Instagram" })
  @IsString()
  @Length(1, 40)
  label!: string;

  @ApiProperty({ example: "https://instagram.com/vrinoor" })
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @Length(1, 300)
  url!: string;
}

export class BrandDto {
  @ApiProperty({ maxLength: 80 })
  @IsString()
  @Length(1, 80)
  name!: string;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @Length(0, 160)
  tagline!: string;

  @ApiProperty({ maxLength: 300 })
  @IsString()
  @Length(0, 300)
  description!: string;

  @ApiProperty({ nullable: true, type: String, description: "Cloudinary image URL of the logo." })
  @ValidateIf((brand: BrandDto) => brand.logoUrl !== null)
  @Matches(CLOUDINARY_IMAGE, { message: "logoUrl must be a Cloudinary image URL" })
  logoUrl!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "Cloudinary image URL of the favicon (square PNG).",
  })
  @ValidateIf((brand: BrandDto) => brand.faviconUrl !== null)
  @Matches(CLOUDINARY_IMAGE, { message: "faviconUrl must be a Cloudinary image URL" })
  faviconUrl!: string | null;

  @ApiProperty({ format: "email" })
  @IsEmail()
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  @ValidateIf((brand: BrandDto) => brand.phone !== null)
  @Matches(/^\+?[0-9 ()-]{7,20}$/, { message: "phone must be a valid phone number" })
  phone!: string | null;

  @ApiProperty({ nullable: true, type: String, maxLength: 300 })
  @ValidateIf((brand: BrandDto) => brand.address !== null)
  @IsString()
  @Length(0, 300)
  address!: string | null;

  @ApiProperty({ type: [SocialLinkDto] })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks!: SocialLinkDto[];
}

export class ThemeDto {
  @ApiProperty({ example: "#38251d" })
  @Matches(HEX_COLOUR, { message: "colours must be six-digit hex values such as #38251d" })
  brown!: string;

  @ApiProperty({ example: "#f8f1e7" })
  @Matches(HEX_COLOUR, { message: "colours must be six-digit hex values such as #f8f1e7" })
  cream!: string;

  @ApiProperty({ example: "#b39465" })
  @Matches(HEX_COLOUR, { message: "colours must be six-digit hex values such as #b39465" })
  gold!: string;
}

export class StoreSettingsDto {
  @ApiProperty({ type: BrandDto })
  @ValidateNested()
  @Type(() => BrandDto)
  brand!: BrandDto;

  @ApiProperty({ type: ThemeDto })
  @ValidateNested()
  @Type(() => ThemeDto)
  theme!: ThemeDto;

  @ApiProperty({ type: [HomeSectionDto] })
  @IsArray()
  @ArrayMaxSize(HOME_SECTION_IDS.length)
  @ValidateNested({ each: true })
  @Type(() => HomeSectionDto)
  homeSections!: HomeSectionDto[];
}

export type StoreSettingsResponse = StoreSettingsView;
