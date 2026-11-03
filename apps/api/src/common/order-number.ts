import { randomBytes } from "node:crypto";

/**
 * Customer-facing order number, for example "JWL-M2K9XQ-7F3A". The time part sorts roughly by date,
 * and the random tail keeps it hard to guess. The database enforces uniqueness.
 */
export function generateOrderNumber(now = new Date()): string {
  const time = now.getTime().toString(36).toUpperCase().slice(-6).padStart(6, "0");
  const random = randomBytes(2).toString("hex").toUpperCase();
  return `JWL-${time}-${random}`;
}
