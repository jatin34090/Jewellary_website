import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
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

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

export class CreateCategoryDto {
  @ApiProperty({ example: "Rings", maxLength: 120 })
  @Transform(trimmed)
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiPropertyOptional({
    example: "rings",
    description: "URL slug. Generated from the name when omitted.",
  })
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "slug must be lowercase letters, digits and single hyphens",
  })
  @Length(1, 140)
  slug?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @ApiPropertyOptional({ format: "uri" })
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @Length(1, 500)
  imageUrl?: string;

  @ApiPropertyOptional({ format: "uuid", description: "Parent category for nested navigation." })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

/** Shape returned by the public tree endpoint. Children are nested, so the client renders the menu directly. */
export class CategoryNodeDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  imageUrl!: string | null;

  @ApiProperty({ type: () => [CategoryNodeDto] })
  children!: CategoryNodeDto[];
}
