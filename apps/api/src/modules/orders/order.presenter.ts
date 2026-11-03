import type { Order, OrderItem, Payment, Shipment } from "@jewellery/database";

import { moneyString } from "../../common/money";

export type OrderWithDetails = Order & {
  items: OrderItem[];
  shipments?: Shipment[];
  payments?: Payment[];
};

export interface OrderView {
  orderNumber: string;
  status: Order["status"];
  currency: string;
  subtotal: string;
  discount: string;
  shipping: string;
  tax: string;
  total: string;
  couponCode: string | null;
  items: {
    productId: string;
    sku: string;
    name: string;
    unitPrice: string;
    quantity: number;
    lineTotal: string;
  }[];
  shippingAddress: unknown;
  paidAt: Date | null;
  cancelledAt: Date | null;
  reservationExpiresAt: Date | null;
  createdAt: Date;
  shipment: {
    status: Shipment["status"];
    awbCode: string | null;
    courierName: string | null;
    trackingUrl: string | null;
  } | null;
}

/** The customer-facing shape of an order. Money is a string, and internal fields are left out. */
export function presentOrder(order: OrderWithDetails): OrderView {
  const shipment = order.shipments?.[0] ?? null;
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    currency: order.currency,
    subtotal: moneyString(order.subtotal),
    discount: moneyString(order.discountAmount),
    shipping: moneyString(order.shippingAmount),
    tax: moneyString(order.taxAmount),
    total: moneyString(order.totalAmount),
    couponCode: order.couponCode,
    items: order.items.map((item) => ({
      productId: item.productId,
      sku: item.sku,
      name: item.name,
      unitPrice: moneyString(item.unitPrice),
      quantity: item.quantity,
      lineTotal: moneyString(item.lineTotal),
    })),
    shippingAddress: order.shippingAddress,
    paidAt: order.paidAt,
    cancelledAt: order.cancelledAt,
    reservationExpiresAt: order.reservationExpiresAt,
    createdAt: order.createdAt,
    shipment: shipment
      ? {
          status: shipment.status,
          awbCode: shipment.awbCode,
          courierName: shipment.courierName,
          trackingUrl: shipment.trackingUrl,
        }
      : null,
  };
}
