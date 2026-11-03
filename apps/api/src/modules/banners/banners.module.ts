import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  PartialType,
} from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";
import { BannerPlacement, type AppPrismaClient, type Banner } from "@jewellery/database";

import { CurrentUser, Public, Roles } from "../../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { CATALOGUE_ROLES } from "../../common/auth/roles.constants";
import { withoutUndefined } from "../../common/utils/defined";
import { PRISMA } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { AuditService } from "../audit/audit.service";
import { isCloudinaryUrl } from "../uploads/cloudinary";
import { INTEGRATIONS } from "../../config/config.module";
import type { Integrations } from "../../config/integrations";

const PLACEMENTS = ["HOME_HERO", "HOME_PROMO"] as const;

export class CreateBannerDto {
  @ApiProperty({ enum: PLACEMENTS })
  @IsIn(PLACEMENTS)
  placement!: (typeof PLACEMENTS)[number];

  @ApiProperty({ maxLength: 150 })
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 150)
  title!: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  subtitle?: string;

  @ApiProperty({ description: "Cloudinary image URL for desktop." })
  @Matches(/^https:\/\/res\.cloudinary\.com\/.+\/image\/upload\/.+$/, {
    message: "imageUrl must be a Cloudinary image URL",
  })
  imageUrl!: string;

  @ApiPropertyOptional({ description: "Cloudinary image URL for phones. Falls back to imageUrl." })
  @IsOptional()
  @Matches(/^https:\/\/res\.cloudinary\.com\/.+\/image\/upload\/.+$/, {
    message: "mobileImageUrl must be a Cloudinary image URL",
  })
  mobileImageUrl?: string;

  @ApiPropertyOptional({
    description: "Where the banner links: a path on the store (/shop) or an https URL.",
  })
  @IsOptional()
  @Matches(/^(\/[^\s]*|https:\/\/[^\s]+)$/, {
    message: "linkUrl must be a store path such as /shop or an https link",
  })
  @Length(1, 500)
  linkUrl?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @IsISO8601()
  endsAt?: string;
}

export class UpdateBannerDto extends PartialType(CreateBannerDto) {}

@Injectable()
export class BannersService {
  constructor(
    @Inject(PRISMA) private readonly prisma: AppPrismaClient,
    private readonly audit: AuditService,
    @Inject(INTEGRATIONS) private readonly integrations: Integrations,
  ) {}

  list(): Promise<Banner[]> {
    return this.prisma.banner.findMany({ orderBy: [{ placement: "asc" }, { sortOrder: "asc" }] });
  }

  /** Banners live right now: active, and inside their date window if one is set. */
  live(placement: string): Promise<Banner[]> {
    const now = new Date();
    return this.prisma.banner.findMany({
      where: {
        placement: placement as BannerPlacement,
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      orderBy: { sortOrder: "asc" },
      take: 10,
    });
  }

  async create(dto: CreateBannerDto, actorId: string): Promise<Banner> {
    this.assertCloudinary(dto.imageUrl, dto.mobileImageUrl);
    this.assertWindow(dto.startsAt, dto.endsAt);
    return this.prisma.$transaction(async (tx) => {
      const banner = await tx.banner.create({
        data: {
          placement: dto.placement,
          title: dto.title,
          subtitle: dto.subtitle ?? null,
          imageUrl: dto.imageUrl,
          mobileImageUrl: dto.mobileImageUrl ?? null,
          linkUrl: dto.linkUrl ?? null,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
          endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        },
      });
      await this.audit.record(
        { actorId, action: "banner.created", entityType: "Banner", entityId: banner.id },
        tx,
      );
      return banner;
    });
  }

  async update(id: string, dto: UpdateBannerDto, actorId: string): Promise<Banner> {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Banner not found");
    this.assertCloudinary(
      dto.imageUrl ?? existing.imageUrl,
      dto.mobileImageUrl ?? existing.mobileImageUrl ?? undefined,
    );
    this.assertWindow(
      dto.startsAt ?? existing.startsAt?.toISOString(),
      dto.endsAt ?? existing.endsAt?.toISOString(),
    );

    return this.prisma.$transaction(async (tx) => {
      const banner = await tx.banner.update({
        where: { id },
        data: withoutUndefined({
          placement: dto.placement,
          title: dto.title,
          subtitle: dto.subtitle,
          imageUrl: dto.imageUrl,
          mobileImageUrl: dto.mobileImageUrl,
          linkUrl: dto.linkUrl,
          sortOrder: dto.sortOrder,
          isActive: dto.isActive,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
          endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        }),
      });
      await this.audit.record(
        { actorId, action: "banner.updated", entityType: "Banner", entityId: id },
        tx,
      );
      return banner;
    });
  }

  async remove(id: string, actorId: string): Promise<void> {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Banner not found");
    await this.prisma.$transaction(async (tx) => {
      await tx.banner.delete({ where: { id } });
      await this.audit.record(
        { actorId, action: "banner.deleted", entityType: "Banner", entityId: id },
        tx,
      );
    });
  }

  private assertCloudinary(imageUrl: string, mobileImageUrl?: string): void {
    const cloudName = this.integrations.cloudinary?.cloudName;
    if (!isCloudinaryUrl(imageUrl, cloudName))
      throw new BadRequestException("The banner image must be on your Cloudinary account");
    if (mobileImageUrl && !isCloudinaryUrl(mobileImageUrl, cloudName)) {
      throw new BadRequestException("The mobile banner image must be on your Cloudinary account");
    }
  }

  private assertWindow(startsAt?: string, endsAt?: string): void {
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      throw new BadRequestException("The end date must be after the start date");
    }
  }
}

@ApiTags("Admin: Banners")
@ApiBearerAuth()
@Roles(...CATALOGUE_ROLES)
@Controller("admin/banners")
export class AdminBannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  @ApiOperation({ summary: "All banners, including scheduled and paused ones" })
  list(): Promise<Banner[]> {
    return this.banners.list();
  }

  @Post()
  @ApiOperation({ summary: "Create a banner" })
  create(@Body() dto: CreateBannerDto, @CurrentUser() actor: AuthenticatedUser): Promise<Banner> {
    return this.banners.create(dto, actor.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a banner" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateBannerDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Banner> {
    return this.banners.update(id, dto, actor.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a banner" })
  remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    return this.banners.remove(id, actor.id);
  }
}

@ApiTags("Store")
@Controller("banners")
export class PublicBannersController {
  constructor(private readonly banners: BannersService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "Banners live now for a placement" })
  list(@Query("placement") placement: string | undefined): Promise<Banner[]> {
    if (!placement || !(PLACEMENTS as readonly string[]).includes(placement)) {
      throw new BadRequestException("placement must be HOME_HERO or HOME_PROMO");
    }
    return this.banners.live(placement);
  }
}

@Module({
  imports: [AuditModule],
  controllers: [AdminBannersController, PublicBannersController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}
