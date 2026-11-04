import { Inject, Injectable } from "@nestjs/common";
import type { AppPrismaClient } from "@jewellery/database";

import { PRISMA } from "../../prisma/prisma.module";
import type { ReplaceSavedBagDto, ReplaceWishlistDto } from "./dto/saved-items.dto";

export interface SavedBagLine {
  slug: string;
  productId: string;
  name: string;
  image: string | null;
  quantity: number;
}

/** Only active, non-archived products can be saved. Anything else is dropped silently. */
const LIVE_PRODUCT = { status: "ACTIVE" as const, deletedAt: null };

function isLive(product: { status: string; deletedAt: Date | null }): boolean {
  return product.status === LIVE_PRODUCT.status && product.deletedAt === null;
}

const PRODUCT_SUMMARY = {
  select: {
    id: true,
    slug: true,
    name: true,
    status: true,
    deletedAt: true,
    images: {
      orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }],
      take: 1,
      select: { url: true },
    },
  },
};

/**
 * Server copy of a signed-in customer's bag and wishlist. The browser keeps its own copy for
 * guests and merges into this one at sign-in. Prices are never stored here; checkout reads them fresh.
 */
@Injectable()
export class SavedItemsService {
  constructor(@Inject(PRISMA) private readonly prisma: AppPrismaClient) {}

  async getBag(userId: string): Promise<SavedBagLine[]> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      select: {
        items: {
          orderBy: { createdAt: "asc" },
          select: { quantity: true, product: PRODUCT_SUMMARY },
        },
      },
    });
    return (cart?.items ?? []).flatMap((item) =>
      isLive(item.product)
        ? [
            {
              slug: item.product.slug,
              productId: item.product.id,
              name: item.product.name,
              image: item.product.images[0]?.url ?? null,
              quantity: item.quantity,
            },
          ]
        : [],
    );
  }

  async replaceBag(userId: string, dto: ReplaceSavedBagDto): Promise<SavedBagLine[]> {
    const products = await this.liveProductsBySlug(dto.lines.map((line) => line.slug));
    const seen = new Set<string>();
    const rows = dto.lines.flatMap((line) => {
      const product = products.get(line.slug);
      if (!product || seen.has(line.slug)) return [];
      seen.add(line.slug);
      return [{ productId: product.id, quantity: line.quantity }];
    });

    await this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.upsert({
        where: { userId },
        create: { userId },
        update: {},
        select: { id: true },
      });
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      if (rows.length > 0) {
        await tx.cartItem.createMany({
          data: rows.map((row) => ({ cartId: cart.id, ...row })),
        });
      }
    });
    return this.getBag(userId);
  }

  async getWishlist(userId: string): Promise<string[]> {
    const wishlist = await this.prisma.wishlist.findUnique({
      where: { userId },
      select: {
        items: {
          orderBy: { createdAt: "asc" },
          select: { product: { select: { slug: true, status: true, deletedAt: true } } },
        },
      },
    });
    return (wishlist?.items ?? []).flatMap((item) =>
      isLive(item.product) ? [item.product.slug] : [],
    );
  }

  async replaceWishlist(userId: string, dto: ReplaceWishlistDto): Promise<string[]> {
    const products = await this.liveProductsBySlug(dto.slugs);
    const productIds = [...new Set(dto.slugs)].flatMap((slug) => {
      const product = products.get(slug);
      return product ? [product.id] : [];
    });

    await this.prisma.$transaction(async (tx) => {
      const wishlist = await tx.wishlist.upsert({
        where: { userId },
        create: { userId },
        update: {},
        select: { id: true },
      });
      await tx.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id } });
      if (productIds.length > 0) {
        await tx.wishlistItem.createMany({
          data: productIds.map((productId) => ({ wishlistId: wishlist.id, productId })),
        });
      }
    });
    return this.getWishlist(userId);
  }

  private async liveProductsBySlug(
    slugs: string[],
  ): Promise<Map<string, { id: string; slug: string }>> {
    if (slugs.length === 0) return new Map();
    const rows = await this.prisma.product.findMany({
      where: { slug: { in: slugs }, ...LIVE_PRODUCT },
      select: { id: true, slug: true },
    });
    return new Map(rows.map((row) => [row.slug, row]));
  }
}
