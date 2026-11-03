import { BadRequestException } from "@nestjs/common";

/**
 * Keyset (cursor) pagination. The cursor holds the sort value and id of the last row returned,
 * so the next page starts exactly after it. Unlike OFFSET, the cost does not grow with depth,
 * and inserts or deletes between requests cannot cause rows to be skipped or repeated.
 */
export interface CursorPayload {
  /** The sort column's value on the last row, serialised as text. */
  v: string;
  /** The last row's id, used as the tie-breaker when sort values are equal. */
  id: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as CursorPayload).v === "string" &&
      typeof (parsed as CursorPayload).id === "string"
    ) {
      return parsed as CursorPayload;
    }
  } catch {
    // Fall through to the error below.
  }
  throw new BadRequestException("Invalid pagination cursor");
}

/**
 * Builds the page result. The query fetches one row more than requested. That extra row proves
 * another page exists, without a separate COUNT query.
 */
export function buildCursorPage<T extends { id: string }>(
  rows: T[],
  limit: number,
  cursorValueOf: (row: T) => string,
): CursorPage<T> {
  if (rows.length <= limit) {
    return { items: rows, nextCursor: null };
  }
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  if (!last) {
    return { items, nextCursor: null };
  }
  return {
    items,
    nextCursor: encodeCursor({ v: cursorValueOf(last), id: last.id }),
  };
}
