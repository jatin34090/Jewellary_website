import { Inject, Injectable } from "@nestjs/common";
import {
  Prisma,
  type AppPrismaClient,
  type Coupon,
  type Product,
  type Inventory,
} from "@jewellery/database";

import { money, ZERO } from "../../common/money";
import { PRISMA } from "../../prisma/prisma.module";
import { CouponsService } from "../coupons/coupons.service";
import { stockStatus, type StockStatus } from "../inventory/stock-status";
import { StoreSettingsService } from "../settings/store-settings.service";

export interface CartItemInput {
  productId: string;
  quantity: number;
}

export interface PricedLine {
  product: Product;
  quantity: number;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  availability: StockStatus;
}

export interface PricingIssue {
  productId: string;
  code: "UNAVAILABLE" | "INSUFFICIENT_STOCK";
  message: string;
}

/** Totals are always computed here, from database prices. Client-supplied prices are ignored. */
export interface PricedCart {
  lines: PricedLine[];
  issues: PricingIssue[];
  subtotal: Prisma.Decimal;
  coupon: Coupon | null;
  couponCode: string | null;
  couponError: string | null;
  discount: Prisma.Decimal;
  shipping: Prisma.Decimal;
  tax: Prisma.Decimal;
  total: Prisma.Decimal;
  canCheckout: boolean;
}

@Injectable()
export class PricingService {
  constructor(
    @Inject(PRISMA) private readonly prisma: AppPrismaClient,
    private readonly coupons: CouponsService,
    private readonly settings: StoreSettingsService,
  ) {}

  async price(items: CartItemInput[], couponCode?: string, now = new Date()): Promise<PricedCart> {
    const products = await this.prisma.product.findMany({
      where: { id: { in: items.map((item) => item.productId) } },
      include: { inventory: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));

    const lines: PricedLine[] = [];
    const issues: PricingIssue[] = [];

    for (const item of items) {
      const product = byId.get(item.productId);
      if (!product || product.status !== "ACTIVE" || product.deletedAt !== null) {
        issues.push({
          productId: item.productId,
          code: "UNAVAILABLE",
          message: "This piece is no longer available",
        });
        continue;
      }

      const inventory: Inventory | null = product.inventory;
      const sellable = inventory ? inventory.quantityOnHand - inventory.quantityReserved : 0;
      if (sellable < item.quantity) {
        issues.push({
          productId: item.productId,
          code: "INSUFFICIENT_STOCK",
          message: `Not enough stock for ${product.name} in this quantity`,
        });
      }

      const unitPrice = money(product.price);
      lines.push({
        product,
        quantity: item.quantity,
        unitPrice,
        lineTotal: money(unitPrice.mul(item.quantity)),
        availability: inventory ? stockStatus(inventory) : "OUT_OF_STOCK",
      });
    }

    // Totals include only lines that can be bought. The caller refuses checkout while issues exist.
    const sellableLines = lines.filter(
      (line) => !issues.some((issue) => issue.productId === line.product.id),
    );
    const subtotal = sellableLines.reduce((sum, line) => sum.plus(line.lineTotal), ZERO);

    let coupon: Coupon | null = null;
    let couponError: string | null = null;
    let discount = ZERO;
    const normalisedCode = couponCode?.trim().toUpperCase() || null;

    if (normalisedCode) {
      const check = await this.coupons.check(normalisedCode, subtotal, now);
      coupon = check.coupon;
      couponError = check.error;
      if (coupon) discount = CouponsService.discountFor(coupon, subtotal);
    }

    const rules = await this.settings.checkoutRules();
    const shipping =
      subtotal.isZero() ||
      (rules.freeShippingAbove !== null && subtotal.gte(rules.freeShippingAbove))
        ? ZERO
        : rules.flatShipping;
    const tax = money(subtotal.minus(discount).mul(rules.taxPercent).div(100));
    const total = money(subtotal.minus(discount).plus(shipping).plus(tax));

    return {
      lines,
      issues,
      subtotal: money(subtotal),
      coupon,
      couponCode: normalisedCode,
      couponError,
      discount,
      shipping: money(shipping),
      tax,
      total,
      canCheckout: lines.length > 0 && issues.length === 0 && couponError === null,
    };
  }
}
