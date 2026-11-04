import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type AppPrismaClient } from "@jewellery/database";

import {
  buildCursorPage,
  DEFAULT_PAGE_SIZE,
  decodeCursor,
  type CursorPage,
} from "../../common/pagination/cursor";
import { PRISMA } from "../../prisma/prisma.module";
import type { CatalogueSort, ListProductsQueryDto } from "./dto/catalogue-query.dto";
import {
  detailInclude,
  summaryInclude,
  toPublicDetail,
  toPublicSummary,
  type PublicProductDetail,
  type PublicProductSummary,
} from "./product.views";

interface SortSpec {
  /** Column expression. Only ever taken from this allow-list, never from user input. */
  column: Prisma.Sql;
  /** Postgres type the cursor value is cast back to. */
  cast: "numeric" | "integer" | "timestamp";
  direction: "ASC" | "DESC";
}

/** Each public sort maps to a fixed column. The `id` tie-breaker keeps pages stable when values repeat. */
const SORTS: Record<CatalogueSort, SortSpec> = {
  newest: { column: Prisma.raw('p."createdAt"'), cast: "timestamp", direction: "DESC" },
  price_asc: { column: Prisma.raw("p.price"), cast: "numeric", direction: "ASC" },
  price_desc: { column: Prisma.raw("p.price"), cast: "numeric", direction: "DESC" },
  best_selling: { column: Prisma.raw('p."salesCount"'), cast: "integer", direction: "DESC" },
};

/** Text forms that PostgreSQL produces for each sort column. A cursor must match one of these before it reaches SQL. */
const CURSOR_VALUE_PATTERNS: Record<SortSpec["cast"], RegExp> = {
  numeric: /^\d{1,8}(\.\d{1,2})?$/,
  integer: /^\d{1,9}$/,
  timestamp: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?$/,
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface IdRow {
  id: string;
  sort_value: string;
}

@Injectable()
export class CatalogueService {
  constructor(@Inject(PRISMA) private readonly prisma: AppPrismaClient) {}

  /**
   * Lists active products with filters, search, sorting and keyset pagination.
   * Step 1 finds the page of IDs in one SQL statement. Step 2 loads those products with
   * their images and stock in one batch, so nothing is fetched per row.
   */
  async list(query: ListProductsQueryDto): Promise<CursorPage<PublicProductSummary>> {
    const sort: CatalogueSort = query.sort ?? "newest";
    const spec = SORTS[sort];
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    if (query.minPrice && query.maxPrice && Number(query.minPrice) > Number(query.maxPrice)) {
      throw new BadRequestException("minPrice cannot be greater than maxPrice");
    }

    const conditions: Prisma.Sql[] = [
      Prisma.sql`p.status = 'ACTIVE'`,
      Prisma.sql`p."deletedAt" IS NULL`,
    ];

    if (query.q) {
      conditions.push(Prisma.sql`p."searchVector" @@ websearch_to_tsquery('english', ${query.q})`);
    }
    if (query.category) {
      // The category and every active subcategory below it. UNION (not UNION ALL) stops the walk on any loop.
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "ProductCategory" pc
        WHERE pc."productId" = p.id
          AND pc."categoryId" IN (
            WITH RECURSIVE category_tree AS (
              SELECT c.id FROM "Category" c
              WHERE c.slug = ${query.category}
                AND c."isActive" = true
                AND c."deletedAt" IS NULL
              UNION
              SELECT child.id FROM "Category" child
              JOIN category_tree parent ON child."parentId" = parent.id
              WHERE child."isActive" = true
                AND child."deletedAt" IS NULL
            )
            SELECT id FROM category_tree
          )
      )`);
    }
    if (query.minPrice) {
      conditions.push(Prisma.sql`p.price >= ${query.minPrice}::numeric`);
    }
    if (query.maxPrice) {
      conditions.push(Prisma.sql`p.price <= ${query.maxPrice}::numeric`);
    }
    if (query.featured !== undefined) {
      conditions.push(Prisma.sql`p."isFeatured" = ${query.featured}`);
    }
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      if (!CURSOR_VALUE_PATTERNS[spec.cast].test(cursor.v) || !UUID_PATTERN.test(cursor.id)) {
        throw new BadRequestException("Invalid pagination cursor");
      }
      // Row comparison: rows strictly after the cursor in this sort order.
      const operator = spec.direction === "DESC" ? Prisma.sql`<` : Prisma.sql`>`;
      conditions.push(
        Prisma.sql`(${spec.column}, p.id) ${operator} (${cursor.v}::${Prisma.raw(spec.cast)}, ${cursor.id}::uuid)`,
      );
    }

    const rows = await this.prisma.$queryRaw<IdRow[]>(Prisma.sql`
      SELECT p.id, (${spec.column})::text AS sort_value
      FROM "Product" p
      WHERE ${Prisma.join(conditions, " AND ")}
      ORDER BY ${spec.column} ${Prisma.raw(spec.direction)}, p.id ${Prisma.raw(spec.direction)}
      LIMIT ${limit + 1}
    `);

    const page = buildCursorPage(rows, limit, (row) => row.sort_value);
    if (page.items.length === 0) {
      return { items: [], nextCursor: null };
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: page.items.map((row) => row.id) } },
      include: summaryInclude,
    });
    const byId = new Map(products.map((product) => [product.id, product]));

    const items: PublicProductSummary[] = [];
    for (const row of page.items) {
      const product = byId.get(row.id);
      if (product) items.push(toPublicSummary(product));
    }

    return { items, nextCursor: page.nextCursor };
  }

  /** Product detail with related items. Only ACTIVE products are visible; everything else is a 404. */
  async getBySlug(slug: string): Promise<PublicProductDetail> {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: "ACTIVE", deletedAt: null },
      include: detailInclude,
    });
    if (!product) {
      throw new NotFoundException("Product not found");
    }

    const categoryIds = product.categories
      .map((link) => link.category)
      .filter((category) => category.isActive && category.deletedAt === null)
      .map((category) => category.id);

    const related =
      categoryIds.length === 0
        ? []
        : await this.prisma.product.findMany({
            where: {
              id: { not: product.id },
              status: "ACTIVE",
              deletedAt: null,
              categories: {
                some: {
                  categoryId: { in: categoryIds },
                  category: { isActive: true, deletedAt: null },
                },
              },
            },
            orderBy: [{ salesCount: "desc" }, { id: "asc" }],
            take: 8,
            include: summaryInclude,
          });

    return toPublicDetail(product, related.map(toPublicSummary));
  }
}
