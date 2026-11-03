import { Inject, Injectable } from "@nestjs/common";
import { Prisma, type AppPrismaClient } from "@jewellery/database";

import { money, ZERO } from "../../common/money";
import { PRISMA } from "../../prisma/prisma.module";

export interface CheckoutRules {
  /** Shipping charged below the free-shipping threshold. Zero until the store owner sets it. */
  flatShipping: Prisma.Decimal;
  /** Orders at or above this subtotal ship free. Null means no threshold. */
  freeShippingAbove: Prisma.Decimal | null;
  /** GST-style tax as a percentage of the discounted subtotal. Zero until configured. */
  taxPercent: Prisma.Decimal;
}

export const SETTING_KEYS = {
  shippingFlat: "checkout.shipping.flatRate",
  shippingFreeAbove: "checkout.shipping.freeAbove",
  taxPercent: "checkout.taxPercent",
} as const;

const DEFAULTS: CheckoutRules = {
  flatShipping: ZERO,
  freeShippingAbove: null,
  taxPercent: ZERO,
};

@Injectable()
export class StoreSettingsService {
  constructor(@Inject(PRISMA) private readonly prisma: AppPrismaClient) {}

  async checkoutRules(): Promise<CheckoutRules> {
    const rows = await this.prisma.storeSetting.findMany({
      where: { key: { in: Object.values(SETTING_KEYS) } },
    });
    const byKey = new Map(rows.map((row) => [row.key, row.value]));

    const flat = byKey.get(SETTING_KEYS.shippingFlat);
    const freeAbove = byKey.get(SETTING_KEYS.shippingFreeAbove);
    const tax = byKey.get(SETTING_KEYS.taxPercent);

    return {
      flatShipping: typeof flat === "string" ? money(flat) : DEFAULTS.flatShipping,
      freeShippingAbove:
        typeof freeAbove === "string" ? money(freeAbove) : DEFAULTS.freeShippingAbove,
      taxPercent: typeof tax === "string" ? new Prisma.Decimal(tax) : DEFAULTS.taxPercent,
    };
  }
}
