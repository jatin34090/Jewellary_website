import { describe, expect, it } from "vitest";

import { formatPrice, toPaise } from "./money";

describe("money", () => {
  it("converts decimal strings to integer paise without float error", () => {
    expect(toPaise("0.10") + toPaise("0.20")).toBe(30);
    expect(toPaise("12999.50")).toBe(1299950);
    expect(toPaise("1000")).toBe(100000);
  });

  it("rejects malformed amounts", () => {
    expect(() => toPaise("12.345")).toThrow(RangeError);
    expect(() => toPaise("-5")).toThrow(RangeError);
    expect(() => toPaise("abc")).toThrow(RangeError);
  });

  it("formats in Indian rupees, showing paise only when present", () => {
    expect(formatPrice("1000")).toBe("₹1,000");
    expect(formatPrice("2500.50")).toBe("₹2,500.50");
  });
});
