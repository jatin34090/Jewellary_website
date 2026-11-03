export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface StockLevels {
  quantityOnHand: number;
  quantityReserved: number;
  lowStockThreshold: number;
}

/**
 * Converts raw stock numbers into the status shown to shoppers. Shoppers never see exact counts:
 * that prevents competitors from scraping inventory and avoids a "last one" rush on partial data.
 * Sellable quantity is on-hand minus reserved, since reserved units belong to pending orders.
 */
export function stockStatus(levels: StockLevels): StockStatus {
  const sellable = levels.quantityOnHand - levels.quantityReserved;
  if (sellable <= 0) return "OUT_OF_STOCK";
  if (sellable <= levels.lowStockThreshold) return "LOW_STOCK";
  return "IN_STOCK";
}
