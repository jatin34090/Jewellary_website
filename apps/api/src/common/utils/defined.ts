/**
 * Drops keys whose value is undefined. Prisma update inputs treat an omitted field as "leave unchanged",
 * but with exactOptionalPropertyTypes an explicit undefined is rejected. Use this when building
 * partial updates from optional DTO fields.
 */
export function withoutUndefined<T extends Record<string, unknown>>(
  input: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}
