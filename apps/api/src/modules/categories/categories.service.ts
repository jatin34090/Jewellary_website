import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type AppPrismaClient, type Category } from "@jewellery/database";

import { AuditService } from "../audit/audit.service";
import { PRISMA } from "../../prisma/prisma.module";
import { slugify } from "../../common/utils/slug";
import { withoutUndefined } from "../../common/utils/defined";
import type { CreateCategoryDto, UpdateCategoryDto } from "./dto/category.dto";

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  children: CategoryNode[];
}

const MAX_ANCESTOR_DEPTH = 10;

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(PRISMA) private readonly prisma: AppPrismaClient,
    private readonly audit: AuditService,
  ) {}

  /** Returns every visible category as a nested tree. One query, so there is no N+1 on nested levels. */
  async listTree(): Promise<CategoryNode[]> {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        parentId: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
      },
    });

    const nodes = new Map<string, CategoryNode>();
    for (const row of rows) {
      nodes.set(row.id, {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        imageUrl: row.imageUrl,
        children: [],
      });
    }

    const roots: CategoryNode[] = [];
    for (const row of rows) {
      const node = nodes.get(row.id);
      if (!node) continue;
      const parent = row.parentId ? nodes.get(row.parentId) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async getVisibleBySlug(slug: string): Promise<Category> {
    const category = await this.prisma.category.findFirst({
      where: { slug, isActive: true, deletedAt: null },
    });
    if (!category) {
      throw new NotFoundException("Category not found");
    }
    return category;
  }

  async findById(id: string): Promise<Category> {
    const category = await this.prisma.category.findFirst({ where: { id, deletedAt: null } });
    if (!category) {
      throw new NotFoundException("Category not found");
    }
    return category;
  }

  async create(dto: CreateCategoryDto, actorId: string): Promise<Category> {
    if (dto.parentId) {
      await this.assertParentExists(dto.parentId);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const category = await tx.category.create({
          data: {
            name: dto.name,
            slug: dto.slug ?? slugify(dto.name),
            description: dto.description ?? null,
            imageUrl: dto.imageUrl ?? null,
            parentId: dto.parentId ?? null,
            sortOrder: dto.sortOrder ?? 0,
            isActive: dto.isActive ?? true,
          },
        });
        await this.audit.record(
          { actorId, action: "category.created", entityType: "Category", entityId: category.id },
          tx,
        );
        return category;
      });
    } catch (error) {
      throw this.translateWriteError(error);
    }
  }

  async update(id: string, dto: UpdateCategoryDto, actorId: string): Promise<Category> {
    await this.findById(id);

    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException("A category cannot be its own parent");
      }
      await this.assertParentExists(dto.parentId);
      await this.assertNoCycle(id, dto.parentId);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.category.update({
          where: { id },
          data: withoutUndefined({
            name: dto.name,
            slug: dto.slug,
            description: dto.description,
            imageUrl: dto.imageUrl,
            parentId: dto.parentId,
            sortOrder: dto.sortOrder,
            isActive: dto.isActive,
          }),
        });
        await this.audit.record(
          {
            actorId,
            action: "category.updated",
            entityType: "Category",
            entityId: id,
            changes: { fields: Object.keys(dto) } satisfies Prisma.InputJsonObject,
          },
          tx,
        );
        return updated;
      });
    } catch (error) {
      throw this.translateWriteError(error);
    }
  }

  /** Soft delete. Refused while visible subcategories exist, so no branch silently disappears from navigation. */
  async remove(id: string, actorId: string): Promise<void> {
    await this.findById(id);

    const childCount = await this.prisma.category.count({
      where: { parentId: id, deletedAt: null },
    });
    if (childCount > 0) {
      throw new ConflictException("Move or delete the subcategories before deleting this category");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.category.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
      await this.audit.record(
        { actorId, action: "category.deleted", entityType: "Category", entityId: id },
        tx,
      );
    });
  }

  private async assertParentExists(parentId: string): Promise<void> {
    const parent = await this.prisma.category.findFirst({
      where: { id: parentId, deletedAt: null },
      select: { id: true },
    });
    if (!parent) {
      throw new BadRequestException("Parent category does not exist");
    }
  }

  /** Walks up from the proposed parent. Finding the category itself would create a loop. */
  private async assertNoCycle(categoryId: string, proposedParentId: string): Promise<void> {
    let cursor: string | null = proposedParentId;
    for (let depth = 0; cursor && depth < MAX_ANCESTOR_DEPTH; depth++) {
      if (cursor === categoryId) {
        throw new BadRequestException("This move would create a loop in the category tree");
      }
      const ancestor: { parentId: string | null } | null = await this.prisma.category.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = ancestor?.parentId ?? null;
    }
  }

  private translateWriteError(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return new ConflictException("A category with this slug already exists");
    }
    return error;
  }
}
