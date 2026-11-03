import { createLocalStore } from "../storage/local-store";

export interface BagLine {
  slug: string;
  productId: string;
  name: string;
  image: string | null;
  quantity: number;
}

export const MAX_BAG_LINES = 30;
export const MAX_LINE_QUANTITY = 10;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates stored data. The bag only keeps identifiers and quantities. Prices are always fetched fresh. */
export function parseBag(raw: unknown): BagLine[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const lines: BagLine[] = [];

  for (const entry of raw) {
    if (lines.length >= MAX_BAG_LINES) break;
    if (typeof entry !== "object" || entry === null) continue;
    const candidate = entry as Partial<BagLine>;
    if (
      typeof candidate.slug !== "string" ||
      !SLUG_PATTERN.test(candidate.slug) ||
      typeof candidate.productId !== "string" ||
      !UUID_PATTERN.test(candidate.productId) ||
      typeof candidate.name !== "string" ||
      typeof candidate.quantity !== "number" ||
      !Number.isInteger(candidate.quantity) ||
      seen.has(candidate.slug)
    ) {
      continue;
    }
    seen.add(candidate.slug);
    lines.push({
      slug: candidate.slug,
      productId: candidate.productId,
      name: candidate.name.slice(0, 255),
      image: typeof candidate.image === "string" ? candidate.image : null,
      quantity: clampQuantity(candidate.quantity),
    });
  }
  return lines;
}

export function clampQuantity(quantity: number): number {
  return Math.min(MAX_LINE_QUANTITY, Math.max(1, Math.trunc(quantity)));
}

/** Adds a product, or increases its quantity when it is already in the bag. */
export function addLine(
  lines: BagLine[],
  item: Omit<BagLine, "quantity">,
  quantity = 1,
): BagLine[] {
  const existing = lines.find((line) => line.slug === item.slug);
  if (existing) {
    return lines.map((line) =>
      line.slug === item.slug
        ? { ...line, quantity: clampQuantity(line.quantity + quantity) }
        : line,
    );
  }
  if (lines.length >= MAX_BAG_LINES) return lines;
  return [...lines, { ...item, quantity: clampQuantity(quantity) }];
}

export function setLineQuantity(lines: BagLine[], slug: string, quantity: number): BagLine[] {
  return lines.map((line) =>
    line.slug === slug ? { ...line, quantity: clampQuantity(quantity) } : line,
  );
}

export function removeLine(lines: BagLine[], slug: string): BagLine[] {
  return lines.filter((line) => line.slug !== slug);
}

export function countItems(lines: BagLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

export const bagStore = createLocalStore<BagLine[]>({
  key: "vrinoor_bag",
  empty: [],
  parse: parseBag,
});
