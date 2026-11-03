import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Prisma, type AppPrismaClient } from "@jewellery/database";

import { money, ZERO } from "../../common/money";
import { PRISMA } from "../../prisma/prisma.module";
import { AuditService } from "../audit/audit.service";
import type { CheckoutSettingsDto, HomeSectionDto, StoreSettingsDto } from "./dto/settings.dto";

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
  brand: "store.brand",
  theme: "store.theme",
  homeSections: "home.sections",
} as const;

const DEFAULTS: CheckoutRules = {
  flatShipping: ZERO,
  freeShippingAbove: null,
  taxPercent: ZERO,
};

/** Brand defaults match the reference design. Every value can be changed from the admin panel. */
export const DEFAULT_BRAND = {
  name: "VRINOOR",
  tagline: "Where Elegance Meets Noor",
  description:
    "Handcrafted jewellery for every moment: earrings, rings, pendants, bracelets, anklets and combo sets.",
  logoUrl: null as string | null,
  faviconUrl: null as string | null,
  email: "vrinoor.jewels@gmail.com",
  phone: null as string | null,
  address: null as string | null,
  socialLinks: [] as { label: string; url: string }[],
};

export const DEFAULT_THEME = { brown: "#38251d", cream: "#f8f1e7", gold: "#b39465" };

export const HOME_SECTION_IDS = [
  "hero",
  "categories",
  "featured",
  "newArrivals",
  "bestSellers",
  "why",
] as const;

export const DEFAULT_HOME_SECTIONS: HomeSectionDto[] = HOME_SECTION_IDS.map((id) => ({
  id,
  enabled: true,
}));

export interface StoreSettingsView {
  brand: typeof DEFAULT_BRAND;
  theme: typeof DEFAULT_THEME;
  homeSections: HomeSectionDto[];
}

@Injectable()
export class StoreSettingsService {
  constructor(
    @Inject(PRISMA) private readonly prisma: AppPrismaClient,
    private readonly audit: AuditService,
  ) {}

  async checkoutRules(): Promise<CheckoutRules> {
    const rows = await this.prisma.storeSetting.findMany({
      where: {
        key: {
          in: [SETTING_KEYS.shippingFlat, SETTING_KEYS.shippingFreeAbove, SETTING_KEYS.taxPercent],
        },
      },
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

  /** Shipping and tax as the admin screen edits them. Money is returned as strings. */
  async getCheckoutSettings(): Promise<CheckoutSettingsDto> {
    const rules = await this.checkoutRules();
    return {
      flatRate: rules.flatShipping.toFixed(2),
      freeShippingAbove: rules.freeShippingAbove ? rules.freeShippingAbove.toFixed(2) : null,
      taxPercent: rules.taxPercent.toFixed(2),
    };
  }

  async updateCheckoutSettings(
    dto: CheckoutSettingsDto,
    actorId: string,
  ): Promise<CheckoutSettingsDto> {
    const taxPercent = Number(dto.taxPercent);
    if (taxPercent < 0 || taxPercent > 100) {
      throw new BadRequestException("Tax percent must be between 0 and 100");
    }

    await this.prisma.$transaction(async (tx) => {
      await this.write(tx, SETTING_KEYS.shippingFlat, dto.flatRate);
      await this.write(tx, SETTING_KEYS.shippingFreeAbove, dto.freeShippingAbove ?? null);
      await this.write(tx, SETTING_KEYS.taxPercent, dto.taxPercent);
      await this.audit.record(
        {
          actorId,
          action: "settings.checkout_updated",
          entityType: "StoreSetting",
          entityId: "checkout",
          changes: {
            flatRate: dto.flatRate,
            freeShippingAbove: dto.freeShippingAbove ?? null,
            taxPercent: dto.taxPercent,
          } satisfies Prisma.InputJsonObject,
        },
        tx,
      );
    });
    return this.getCheckoutSettings();
  }

  /** Brand, theme and homepage sections, with defaults for anything not yet set. */
  async getStoreSettings(): Promise<StoreSettingsView> {
    const rows = await this.prisma.storeSetting.findMany({
      where: { key: { in: [SETTING_KEYS.brand, SETTING_KEYS.theme, SETTING_KEYS.homeSections] } },
    });
    const byKey = new Map(rows.map((row) => [row.key, row.value]));

    const brand = byKey.get(SETTING_KEYS.brand);
    const theme = byKey.get(SETTING_KEYS.theme);
    const sections = byKey.get(SETTING_KEYS.homeSections);

    return {
      brand: { ...DEFAULT_BRAND, ...(isRecord(brand) ? brand : {}) },
      theme: { ...DEFAULT_THEME, ...(isRecord(theme) ? theme : {}) },
      homeSections: mergeSections(sections),
    };
  }

  async updateStoreSettings(dto: StoreSettingsDto, actorId: string): Promise<StoreSettingsView> {
    await this.prisma.$transaction(async (tx) => {
      await this.write(tx, SETTING_KEYS.brand, dto.brand);
      await this.write(tx, SETTING_KEYS.theme, dto.theme);
      await this.write(tx, SETTING_KEYS.homeSections, dto.homeSections);
      await this.audit.record(
        {
          actorId,
          action: "settings.store_updated",
          entityType: "StoreSetting",
          entityId: "store",
          changes: { fields: ["brand", "theme", "homeSections"] } satisfies Prisma.InputJsonObject,
        },
        tx,
      );
    });
    return this.getStoreSettings();
  }

  /** Stores a setting. A null value is stored as JSON null, which the readers treat as "not set". */
  private async write(tx: Prisma.TransactionClient, key: string, value: unknown): Promise<void> {
    const json =
      value === null || value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
    await tx.storeSetting.upsert({
      where: { key },
      create: { key, value: json },
      update: { value: json },
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Keeps the saved order and enabled flags, and adds any section that is new since the last save. */
function mergeSections(saved: unknown): HomeSectionDto[] {
  if (!Array.isArray(saved)) return DEFAULT_HOME_SECTIONS;
  const known = new Set<string>(HOME_SECTION_IDS);
  const result: HomeSectionDto[] = [];
  for (const entry of saved) {
    if (isRecord(entry) && typeof entry["id"] === "string" && known.has(entry["id"])) {
      result.push({ id: entry["id"] as HomeSectionDto["id"], enabled: entry["enabled"] !== false });
    }
  }
  for (const id of HOME_SECTION_IDS) {
    if (!result.some((section) => section.id === id)) result.push({ id, enabled: true });
  }
  return result;
}
