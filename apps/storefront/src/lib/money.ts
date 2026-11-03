import { SITE } from "./config/site";

const DECIMAL_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

/**
 * Converts a decimal money string to whole paise (1/100 rupee). All arithmetic happens on integers,
 * so totals never drift the way binary floats do (0.1 + 0.2 !== 0.3).
 */
export function toPaise(amount: string): number {
  if (!DECIMAL_PATTERN.test(amount)) {
    throw new RangeError(`Invalid money amount: ${amount}`);
  }
  const [whole = "0", fraction = ""] = amount.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function formatPaise(paise: number): string {
  const hasPaise = paise % 100 !== 0;
  return new Intl.NumberFormat(SITE.locale, {
    style: "currency",
    currency: SITE.currency,
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function formatPrice(amount: string): string {
  return formatPaise(toPaise(amount));
}
