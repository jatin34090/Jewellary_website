import { describe, expect, it } from "vitest";

import {
  addLine,
  countItems,
  MAX_BAG_LINES,
  MAX_LINE_QUANTITY,
  mergeBagLines,
  parseBag,
  removeLine,
  setLineQuantity,
  type BagLine,
} from "./bag";

const PRODUCT_ID = "0190f6a2-0000-7000-8000-000000000001";

const item = { slug: "aurora-ring", productId: PRODUCT_ID, name: "Aurora Ring", image: null };

describe("bag", () => {
  it("adds a new line and increments an existing one", () => {
    let lines: BagLine[] = addLine([], item);
    lines = addLine(lines, item, 2);
    expect(lines).toEqual([{ ...item, quantity: 3 }]);
  });

  it("caps quantity per line", () => {
    const lines = addLine([], item, 99);
    expect(lines[0]?.quantity).toBe(MAX_LINE_QUANTITY);
  });

  it("does not add beyond the bag size limit", () => {
    let lines: BagLine[] = [];
    for (let i = 0; i < MAX_BAG_LINES + 5; i++) {
      lines = addLine(lines, { ...item, slug: `product-${i}` });
    }
    expect(lines).toHaveLength(MAX_BAG_LINES);
  });

  it("updates and removes lines", () => {
    const lines = addLine([], item);
    expect(setLineQuantity(lines, item.slug, 4)[0]?.quantity).toBe(4);
    expect(removeLine(lines, item.slug)).toEqual([]);
    expect(countItems(addLine(lines, item, 2))).toBe(3);
  });

  it("drops malformed, duplicate and out-of-range stored entries", () => {
    const parsed = parseBag([
      { ...item, quantity: 2 },
      { ...item, quantity: 5 }, // duplicate slug
      { slug: "Bad Slug!", productId: PRODUCT_ID, name: "x", image: null, quantity: 1 },
      { ...item, slug: "orbit-band", productId: "not-a-uuid", quantity: 1 },
      { ...item, slug: "rings-2", quantity: 1.5 },
      "not an object",
    ]);
    expect(parsed).toEqual([{ ...item, quantity: 2 }]);
  });

  it("returns an empty bag for non-array storage content", () => {
    expect(parseBag({ hello: "world" })).toEqual([]);
    expect(parseBag(null)).toEqual([]);
  });
});

describe("mergeBagLines", () => {
  const other = { ...item, slug: "orbit-band", productId: "0190f6a2-0000-7000-8000-000000000002" };

  it("keeps each product once and the larger quantity", () => {
    const merged = mergeBagLines([{ ...item, quantity: 2 }], [{ ...item, quantity: 5 }]);
    expect(merged).toEqual([{ ...item, quantity: 5 }]);
  });

  it("combines lines that only one side has, local first", () => {
    const merged = mergeBagLines([{ ...item, quantity: 1 }], [{ ...other, quantity: 3 }]);
    expect(merged.map((line) => line.slug)).toEqual([item.slug, other.slug]);
  });

  it("never exceeds the bag size limit", () => {
    const remote = Array.from({ length: MAX_BAG_LINES + 5 }, (_, i) => ({
      ...item,
      slug: `product-${i}`,
      quantity: 1,
    }));
    expect(mergeBagLines([], remote)).toHaveLength(MAX_BAG_LINES);
  });
});
