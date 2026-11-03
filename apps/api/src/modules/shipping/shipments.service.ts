import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma, type AppPrismaClient } from "@jewellery/database";

import { INTEGRATIONS } from "../../config/config.module";
import type { Integrations } from "../../config/integrations";
import { PRISMA } from "../../prisma/prisma.module";
import { ShiprocketClient, type ShiprocketOrderPayload } from "./shiprocket.client";

export const MAX_BOOKING_ATTEMPTS = 5;
const SWEEP_BATCH = 20;

interface ShippingAddressSnapshot {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
}

/** Books paid orders with the courier. Failures are recorded and retried by the background sweep. */
@Injectable()
export class ShipmentsService {
  private readonly logger = new Logger("Shipments");
  private readonly client: ShiprocketClient | null;

  constructor(
    @Inject(PRISMA) private readonly prisma: AppPrismaClient,
    @Inject(INTEGRATIONS) private readonly integrations: Integrations,
  ) {
    this.client = integrations.shiprocket ? new ShiprocketClient(integrations.shiprocket) : null;
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  /** Books one paid order. Safe to call repeatedly: already-booked steps are skipped. */
  async bookPaidOrder(orderId: string): Promise<void> {
    const config = this.integrations.shiprocket;
    if (!this.client || !config) return;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: { select: { weightGrams: true } } } }, user: true },
    });
    if (!order || order.status !== "PAID") return;

    let shipment = await this.prisma.shipment.findFirst({
      where: { orderId, provider: "SHIPROCKET" },
    });
    if (shipment?.awbCode) return;
    if (shipment && shipment.bookingAttempts >= MAX_BOOKING_ATTEMPTS) return;

    shipment ??= await this.prisma.shipment.create({ data: { orderId, provider: "SHIPROCKET" } });
    shipment = await this.prisma.shipment.update({
      where: { id: shipment.id },
      data: { bookingAttempts: { increment: 1 } },
    });

    try {
      let shipmentId = shipment.providerShipmentId;
      if (!shipmentId) {
        const payload = this.buildPayload(order, config);
        const created = await this.client.createOrder(payload);
        if (typeof created.shipment_id !== "number")
          throw new Error("Shiprocket did not return a shipment id");
        shipmentId = String(created.shipment_id);
        await this.prisma.shipment.update({
          where: { id: shipment.id },
          data: { providerShipmentId: shipmentId },
        });
      }

      const awb = await this.client.assignAwb(Number(shipmentId));
      await this.prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          status: "BOOKED",
          awbCode: awb.awb_code,
          courierName: awb.courier_name,
          trackingUrl: trackingUrlFor(awb.awb_code),
          lastError: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown booking error";
      this.logger.warn(`Booking for order ${order.orderNumber} failed: ${message}`);
      await this.prisma.shipment.update({
        where: { id: shipment.id },
        data: { lastError: message.slice(0, 500) },
      });
    }
  }

  /** Background sweep: books paid orders that have no shipment yet, and retries failed bookings. */
  async sweep(): Promise<void> {
    if (!this.client) return;

    const unbooked = await this.prisma.order.findMany({
      where: { status: "PAID", shipments: { none: {} } },
      select: { id: true },
      take: SWEEP_BATCH,
    });
    const retryable = await this.prisma.shipment.findMany({
      where: {
        awbCode: null,
        bookingAttempts: { lt: MAX_BOOKING_ATTEMPTS },
        order: { status: "PAID" },
      },
      select: { orderId: true },
      take: SWEEP_BATCH,
    });

    const orderIds = new Set([...unbooked.map((o) => o.id), ...retryable.map((s) => s.orderId)]);
    for (const orderId of orderIds) {
      await this.bookPaidOrder(orderId);
    }
  }

  private buildPayload(
    order: Prisma.OrderGetPayload<{
      include: { items: { include: { product: { select: { weightGrams: true } } } }; user: true };
    }>,
    config: NonNullable<Integrations["shiprocket"]>,
  ): ShiprocketOrderPayload {
    const address = order.shippingAddress as unknown as ShippingAddressSnapshot;
    const [first = address.fullName, ...rest] = address.fullName.split(" ");
    const paidAt = order.paidAt ?? new Date();

    // Weight: product weight in grams where known, otherwise the configured default per unit.
    const weightKg = order.items.reduce((sum, item) => {
      const unitKg = item.product.weightGrams
        ? Number(item.product.weightGrams) / 1000
        : config.defaultWeightKg;
      return sum + unitKg * item.quantity;
    }, 0);

    return {
      order_id: order.orderNumber,
      order_date: formatShiprocketDate(paidAt),
      pickup_location: config.pickupLocation,
      billing_customer_name: first,
      billing_last_name: rest.join(" ") || first,
      billing_address: address.line1,
      billing_address_2: address.line2 ?? "",
      billing_city: address.city,
      billing_pincode: address.postalCode,
      billing_state: address.state,
      billing_country: "India",
      billing_email: order.user.email,
      billing_phone: address.phone,
      shipping_is_billing: true,
      order_items: order.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        units: item.quantity,
        selling_price: item.unitPrice.toFixed(2),
        discount: "0",
        tax: "0",
      })),
      payment_method: "Prepaid",
      shipping_charges: Number(order.shippingAmount),
      total_discount: Number(order.discountAmount),
      sub_total: Number(order.subtotal),
      length: config.defaultLengthCm,
      breadth: config.defaultBreadthCm,
      height: config.defaultHeightCm,
      weight: Math.max(0.01, Number(weightKg.toFixed(3))),
    };
  }
}

export function trackingUrlFor(awbCode: string): string {
  return `https://shiprocket.co/tracking/${encodeURIComponent(awbCode)}`;
}

/** Shiprocket expects "YYYY-MM-DD HH:mm" in IST. */
export function formatShiprocketDate(date: Date): string {
  const ist = new Date(date.getTime() + 330 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())} ${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`;
}
