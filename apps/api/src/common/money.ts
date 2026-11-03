import { Prisma } from "@jewellery/database";

/** Money helpers built on Prisma.Decimal. Amounts stay exact until they leave the server as strings. */

export type DecimalValue = Prisma.Decimal | string | number;

export const ZERO = new Prisma.Decimal(0);

export function money(value: DecimalValue): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function moneyString(value: DecimalValue): string {
  return money(value).toFixed(2);
}

/** Razorpay takes amounts in paise (integers). */
export function toPaise(value: DecimalValue): number {
  return money(value).mul(100).toNumber();
}
