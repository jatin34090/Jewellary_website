import type { Availability } from "@/lib/api/types";

const LABELS: Record<Availability, string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Only a few left",
  OUT_OF_STOCK: "Out of stock",
};

/** Shoppers see a status, never an exact stock count. */
export function AvailabilityBadge({ availability }: { availability: Availability }) {
  const tone =
    availability === "OUT_OF_STOCK"
      ? "text-muted"
      : availability === "LOW_STOCK"
        ? "text-gold-deep"
        : "text-brown-soft";

  return (
    <p className={`inline-flex items-center gap-1.5 text-xs font-medium ${tone}`}>
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${availability === "OUT_OF_STOCK" ? "bg-muted" : availability === "LOW_STOCK" ? "bg-gold" : "bg-brown-soft"}`}
      />
      {LABELS[availability]}
    </p>
  );
}
