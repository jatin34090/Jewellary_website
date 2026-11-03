import { describe, expect, it } from "vitest";

import { MAX_WISHLIST_ITEMS, parseWishlist, toggleWishlist } from "./wishlist";

describe("wishlist", () => {
  it("toggles a slug on and off", () => {
    const added = toggleWishlist([], "aurora-ring");
    expect(added).toEqual(["aurora-ring"]);
    expect(toggleWishlist(added, "aurora-ring")).toEqual([]);
  });

  it("keeps only valid, unique slugs from storage", () => {
    expect(parseWishlist(["aurora-ring", "aurora-ring", "BAD SLUG", 42, "orbit-band"])).toEqual([
      "aurora-ring",
      "orbit-band",
    ]);
  });

  it("caps the list size", () => {
    const many = Array.from({ length: MAX_WISHLIST_ITEMS + 10 }, (_, i) => `item-${i}`);
    expect(parseWishlist(many)).toHaveLength(MAX_WISHLIST_ITEMS);
  });
});
