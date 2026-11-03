import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type AppPrismaClient } from "@jewellery/database";

import { AuditService } from "../audit/audit.service";
import { PRISMA } from "../../prisma/prisma.module";
import { slugify } from "../../common/utils/slug";
import { withoutUndefined } from "../../common/utils/defined";
import { INTEGRATIONS } from "../../config/config.module";
import type { Integrations } from "../../config/integrations";
import { isCloudinaryUrl } from "../uploads/cloudinary";
import type { SetProductVideoDto } from "./dto/product.dto";
import type {
  AddProductImageDto,
  CreateProductDto,
  UpdateProductDto,
  UpdateProductImageDto,
} from "./dto/product.dto";
import type { ListAdminProductsQueryDto } from "./dto/catalogue-query.dto";
import { adminInclude, toAdminView, type AdminProductView } from "./product.views";

export interface AdminProductPage {
  items: AdminProductView[];
  page: number;
  pageSize: number;
  total: number;
}

@Injectable()
export class AdminProductsService {
  constructor(
    @Inject(PRISMA) private readonly prisma: AppPrismaClient,
    @Inject(INTEGRATIONS) private readonly integrations: Integrations,
    private readonly audit: AuditService,
  ) {}

  /** Offset paging is acceptable here: the admin list is used by a small staff team, not by shoppers. */
  async list(query: ListAdminProductsQueryDto): Promise<AdminProductPage> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { sku: { contains: query.q.toUpperCase() } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: adminInclude,
      }),
    ]);

    return { items: rows.map(toAdminView), page, pageSize, total };
  }

  async get(id: string): Promise<AdminProductView> {
    const row = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: adminInclude,
    });
    if (!row) {
      throw new NotFoundException("Product not found");
    }
    return toAdminView(row);
  }

  async create(dto: CreateProductDto, actorId: string): Promise<AdminProductView> {
    assertCompareAtNotBelowPrice(dto.price, dto.compareAtPrice);
    const categoryIds = await this.assertCategoriesExist(dto.categoryIds ?? []);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            sku: dto.sku,
            slug: dto.slug ?? slugify(dto.name),
            name: dto.name,
            description: dto.description,
            price: dto.price,
            compareAtPrice: dto.compareAtPrice ?? null,
            weightGrams: dto.weightGrams ?? null,
            material: dto.material ?? null,
            status: dto.status ?? "DRAFT",
            isFeatured: dto.isFeatured ?? false,
            categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
            inventory: {
              create: {
                quantityOnHand: dto.initialStock ?? 0,
                lowStockThreshold: dto.lowStockThreshold ?? 5,
              },
            },
          },
        });
        await this.audit.record(
          { actorId, action: "product.created", entityType: "Product", entityId: product.id },
          tx,
        );
        return product;
      });
      return await this.get(created.id);
    } catch (error) {
      throw translateWriteError(error);
    }
  }

  async update(id: string, dto: UpdateProductDto, actorId: string): Promise<AdminProductView> {
    const existing = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { price: true, compareAtPrice: true },
    });
    if (!existing) {
      throw new NotFoundException("Product not found");
    }

    // Validate against the effective values, so changing only the price is still checked.
    assertCompareAtNotBelowPrice(
      dto.price ?? existing.price.toFixed(2),
      dto.compareAtPrice !== undefined
        ? dto.compareAtPrice
        : (existing.compareAtPrice?.toFixed(2) ?? undefined),
    );
    const categoryIds = dto.categoryIds
      ? await this.assertCategoriesExist(dto.categoryIds)
      : undefined;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id },
          data: {
            ...withoutUndefined({
              sku: dto.sku,
              slug: dto.slug,
              name: dto.name,
              description: dto.description,
              price: dto.price,
              compareAtPrice: dto.compareAtPrice,
              weightGrams: dto.weightGrams,
              material: dto.material,
              status: dto.status,
              isFeatured: dto.isFeatured,
            }),
            // Replacing the list keeps the join table in step with what the admin selected.
            ...(categoryIds
              ? {
                  categories: {
                    deleteMany: {},
                    create: categoryIds.map((categoryId) => ({ categoryId })),
                  },
                }
              : {}),
          },
        });
        await this.audit.record(
          {
            actorId,
            action: "product.updated",
            entityType: "Product",
            entityId: id,
            changes: { fields: Object.keys(dto) } satisfies Prisma.InputJsonObject,
          },
          tx,
        );
      });
      return await this.get(id);
    } catch (error) {
      throw translateWriteError(error);
    }
  }

  /** Soft delete. The product is archived and hidden from the storefront. Order history still references it. */
  async remove(id: string, actorId: string): Promise<void> {
    await this.get(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { deletedAt: new Date(), status: "ARCHIVED", isFeatured: false },
      });
      await this.audit.record(
        { actorId, action: "product.deleted", entityType: "Product", entityId: id },
        tx,
      );
    });
  }

  async addImage(
    productId: string,
    dto: AddProductImageDto,
    actorId: string,
  ): Promise<AdminProductView> {
    await this.assertProductExists(productId);

    await this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.productImage.count({ where: { productId } });
      // The first image becomes the primary one automatically. Otherwise the admin chooses.
      const becomesPrimary = dto.isPrimary === true || existingCount === 0;

      if (becomesPrimary) {
        await tx.productImage.updateMany({ where: { productId }, data: { isPrimary: false } });
      }

      const image = await tx.productImage.create({
        data: {
          productId,
          url: dto.url,
          publicId: dto.publicId,
          altText: dto.altText ?? null,
          sortOrder: dto.sortOrder ?? existingCount,
          isPrimary: becomesPrimary,
        },
      });
      await this.audit.record(
        {
          actorId,
          action: "product.image_added",
          entityType: "Product",
          entityId: productId,
          changes: { imageId: image.id },
        },
        tx,
      );
    });
    return this.get(productId);
  }

  async updateImage(
    productId: string,
    imageId: string,
    dto: UpdateProductImageDto,
    actorId: string,
  ): Promise<AdminProductView> {
    await this.assertProductExists(productId);

    await this.prisma.$transaction(async (tx) => {
      const image = await tx.productImage.findFirst({ where: { id: imageId, productId } });
      if (!image) {
        throw new NotFoundException("Image not found");
      }
      if (dto.isPrimary === false && image.isPrimary) {
        throw new BadRequestException("Set another image as primary instead");
      }
      if (dto.isPrimary === true) {
        await tx.productImage.updateMany({
          where: { productId, NOT: { id: imageId } },
          data: { isPrimary: false },
        });
      }

      await tx.productImage.update({
        where: { id: imageId },
        data: withoutUndefined({
          url: dto.url,
          publicId: dto.publicId,
          altText: dto.altText,
          sortOrder: dto.sortOrder,
          isPrimary: dto.isPrimary,
        }),
      });
      await this.audit.record(
        {
          actorId,
          action: "product.image_updated",
          entityType: "Product",
          entityId: productId,
          changes: { imageId },
        },
        tx,
      );
    });
    return this.get(productId);
  }

  /** Removes the image record. Returns nothing: the caller can read publicId from the view before deleting. */
  async removeImage(productId: string, imageId: string, actorId: string): Promise<void> {
    await this.assertProductExists(productId);

    await this.prisma.$transaction(async (tx) => {
      const image = await tx.productImage.findFirst({ where: { id: imageId, productId } });
      if (!image) {
        throw new NotFoundException("Image not found");
      }
      await tx.productImage.delete({ where: { id: imageId } });

      // Never leave a product without a primary image while it still has others.
      if (image.isPrimary) {
        const next = await tx.productImage.findFirst({
          where: { productId },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        });
        if (next) {
          await tx.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
        }
      }

      await this.audit.record(
        {
          actorId,
          action: "product.image_removed",
          entityType: "Product",
          entityId: productId,
          changes: { imageId, publicId: image.publicId },
        },
        tx,
      );
    });
  }

  /** Attaches a product video (already uploaded to Cloudinary). Replaces any existing video. */
  async setVideo(
    productId: string,
    dto: SetProductVideoDto,
    actorId: string,
  ): Promise<AdminProductView> {
    await this.assertProductExists(productId);
    if (!isCloudinaryUrl(dto.url, this.integrations.cloudinary?.cloudName)) {
      throw new BadRequestException("The video must be hosted on your Cloudinary account");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: { videoUrl: dto.url, videoPublicId: dto.publicId },
      });
      await this.audit.record(
        {
          actorId,
          action: "product.video_set",
          entityType: "Product",
          entityId: productId,
          changes: { publicId: dto.publicId },
        },
        tx,
      );
    });
    return this.get(productId);
  }

  /** Detaches the video. Returns the Cloudinary public id so the asset can be removed from storage. */
  async removeVideo(productId: string, actorId: string): Promise<string | null> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { videoPublicId: true },
    });
    if (!product) throw new NotFoundException("Product not found");

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: { videoUrl: null, videoPublicId: null },
      });
      await this.audit.record(
        {
          actorId,
          action: "product.video_removed",
          entityType: "Product",
          entityId: productId,
          changes: { publicId: product.videoPublicId },
        },
        tx,
      );
    });
    return product.videoPublicId;
  }

  private async assertProductExists(productId: string): Promise<void> {
    const exists = await this.prisma.product.count({ where: { id: productId, deletedAt: null } });
    if (exists === 0) {
      throw new NotFoundException("Product not found");
    }
  }

  /** Returns the de-duplicated IDs, or throws if any category is missing or deleted. */
  private async assertCategoriesExist(categoryIds: string[]): Promise<string[]> {
    const unique = [...new Set(categoryIds)];
    if (unique.length === 0) return unique;

    const found = await this.prisma.category.count({
      where: { id: { in: unique }, deletedAt: null },
    });
    if (found !== unique.length) {
      throw new BadRequestException("One or more categories do not exist");
    }
    return unique;
  }
}

/** The database enforces compareAtPrice >= price too. Checking here gives the admin a clear message. */
function assertCompareAtNotBelowPrice(
  price: string,
  compareAtPrice: string | null | undefined,
): void {
  if (compareAtPrice === undefined || compareAtPrice === null) return;
  if (new Prisma.Decimal(compareAtPrice).lt(new Prisma.Decimal(price))) {
    throw new BadRequestException("compareAtPrice must be greater than or equal to price");
  }
}

function translateWriteError(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ConflictException("A product with this SKU or slug already exists");
  }
  return error;
}
