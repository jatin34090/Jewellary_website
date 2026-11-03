/**
 * Turns a human name into a URL slug: "Rose Gold Ring" -> "rose-gold-ring".
 * Diacritics are folded to ASCII, and runs of other characters collapse to a single hyphen.
 */
export function slugify(input: string, maxLength = 140): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}
