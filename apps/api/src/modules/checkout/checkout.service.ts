import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type AppPrismaClient } from "@jewellery/database";

import { INTEGRATIONS } from "../../config/config.module";
import type { Integrations } from "../../config/integrations";
import { moneyString, toPaise } from "../../common/money";
import { generateOrderNumber } from "../../common/order-number";
import { PRISMA } from "../../prisma/prisma.module";
import { AddressesService } from "../addresses/addresses.service";
import { PAYMENT_GATEWAY, type PaymentGateway } from "../payments/razorpay.client";
import { PaymentsService } from "../payments/payments.service";
import { presentOrder, type OrderView } from "../orders/order.presenter";
import { PricingService, type PricedCart } from "./pricing.service";
import type {
  CheckoutQuoteDto,
  CreateCheckoutOrderDto,
  VerifyPaymentDto,
} from "./dto/checkout.dto";

export interface QuoteView {
  lines: {
    productId: string;
    slug: string;
    name: string;
    unitPrice: string;
    quantity: number;
    lineTotal: string;
    availability: string;
  }[];
  issues: { productId: string; code: string; message: string }[];
  subtotal: string;
  discount: string;
  couponCode: string | null;
  couponError: string | null;
  shipping: string;
  tax: string;
  total: string;
  currency: "INR";
  canCheckout: boolean;
}

export interface CheckoutOrderView {
  order: OrderView;
  /** What the browser needs to open Razorpay Checkout. Contains only the public key id. */
  payment: {
    provider: "razorpay";
    keyId: string;
    razorpayOrderId: string;
    amount: number;
    currency: "INR";
  };
}

const PRISMA_UNIQUE_VIOLATION = "P2002";

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger("Checkout");

  constructor(
    @Inject(PRISMA) private readonly prisma: AppPrismaClient,
    @Inject(INTEGRATIONS) private readonly integrations: Integrations,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly pricing: PricingService,
    private readonly addresses: AddressesService,
    private readonly payments: PaymentsService,
  ) {}

  async quote(dto: CheckoutQuoteDto): Promise<QuoteView> {
    const priced = await this.pricing.price(dto.items, dto.couponCode);
    return {
      lines: priced.lines.map((line) => ({
        productId: line.product.id,
        slug: line.product.slug,
        name: line.product.name,
        unitPrice: moneyString(line.unitPrice),
        quantity: line.quantity,
        lineTotal: moneyString(line.lineTotal),
        availability: line.availability,
      })),
      issues: priced.issues,
      subtotal: moneyString(priced.subtotal),
      discount: moneyString(priced.discount),
      couponCode: priced.couponCode,
      couponError: priced.couponError,
      shipping: moneyString(priced.shipping),
      tax: moneyString(priced.tax),
      total: moneyString(priced.total),
      currency: "INR",
      canCheckout: priced.canCheckout,
    };
  }

  /**
   * Creates a pending order and reserves its stock. The same Idempotency-Key always returns the same
   * order, so a double click or a network retry cannot create two orders or reserve stock twice.
   */
  async createOrder(
    userId: string,
    dto: CreateCheckoutOrderDto,
    idempotencyKey: string,
  ): Promise<CheckoutOrderView> {
    const existing = await this.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      if (existing.userId !== userId) {
        throw new ConflictException("This checkout key was already used");
      }
      return this.viewWithPayment(existing);
    }

    if (!this.integrations.razorpay) {
      throw new BadRequestException("Online payments are not configured yet");
    }

    const address = await this.addresses.get(userId, dto.addressId);
    const priced = await this.pricing.price(dto.items, dto.couponCode);
    this.assertCheckoutable(priced);

    const amountPaise = toPaise(priced.total);
    if (amountPaise < 100) {
      throw new BadRequestException("The order total must be at least ₹1");
    }

    const orderNumber = generateOrderNumber();
    // The gateway order is created before we reserve stock. If the reservation then fails, the gateway
    // order is never paid, so nothing is charged. Razorpay expires it on its own.
    const gatewayOrder = await this.gateway.createOrder({
      amountPaise,
      currency: "INR",
      receipt: orderNumber,
      notes: { orderNumber },
    });

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        await this.assertPricesUnchanged(tx, priced);

        for (const line of priced.lines) {
          // Reserve only if enough units remain after existing reservations. The WHERE clause is the lock.
          const reserved = await tx.$executeRaw`
            UPDATE "Inventory"
            SET "quantityReserved" = "quantityReserved" + ${line.quantity}
            WHERE "productId" = ${line.product.id}::uuid
              AND "quantityOnHand" - "quantityReserved" >= ${line.quantity}`;
          if (reserved !== 1) {
            throw new ConflictException(
              `Not enough stock for ${line.product.name} in this quantity`,
            );
          }
        }

        if (priced.coupon) {
          const used = await tx.$executeRaw`
            UPDATE "Coupon"
            SET "usedCount" = "usedCount" + 1
            WHERE "id" = ${priced.coupon.id}::uuid
              AND "isActive" = true
              AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
          if (used !== 1) {
            throw new ConflictException("This coupon has just been fully used");
          }
        }

        return tx.order.create({
          data: {
            orderNumber,
            userId,
            status: "PENDING_PAYMENT",
            currency: "INR",
            subtotal: priced.subtotal,
            discountAmount: priced.discount,
            shippingAmount: priced.shipping,
            taxAmount: priced.tax,
            totalAmount: priced.total,
            couponId: priced.coupon?.id ?? null,
            couponCode: priced.coupon?.code ?? null,
            // Snapshot the address: later edits or deletion must not change a placed order.
            shippingAddress: {
              fullName: address.fullName,
              phone: address.phone,
              line1: address.line1,
              line2: address.line2,
              city: address.city,
              state: address.state,
              postalCode: address.postalCode,
              country: address.country,
            },
            idempotencyKey,
            reservationExpiresAt: new Date(
              Date.now() + this.integrations.reservationMinutes * 60_000,
            ),
            items: {
              create: priced.lines.map((line) => ({
                productId: line.product.id,
                sku: line.product.sku,
                name: line.product.name,
                unitPrice: line.unitPrice,
                quantity: line.quantity,
                lineTotal: line.lineTotal,
              })),
            },
            payments: {
              create: {
                provider: "RAZORPAY",
                providerOrderId: gatewayOrder.id,
                amount: priced.total,
                currency: "INR",
                status: "CREATED",
              },
            },
          },
          include: { items: true, payments: true, shipments: true },
        });
      });

      return this.viewWithPayment(order);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_VIOLATION
      ) {
        // A concurrent request with the same key won the race. Return its order.
        const winner = await this.findByIdempotencyKey(idempotencyKey);
        if (winner && winner.userId === userId) return this.viewWithPayment(winner);
        throw new ConflictException("Please try again");
      }
      this.logger.warn(
        `Order ${orderNumber} was not created; gateway order ${gatewayOrder.id} left unpaid`,
      );
      throw error;
    }
  }

  /** Confirms a payment the browser reports. The signature is checked here, and the order is marked paid. */
  async verifyPayment(userId: string, dto: VerifyPaymentDto): Promise<OrderView> {
    this.payments.verifyCheckout(dto.razorpayOrderId, dto.razorpayPaymentId, dto.razorpaySignature);

    const payment = await this.prisma.payment.findFirst({
      where: { providerOrderId: dto.razorpayOrderId, order: { userId } },
      include: { order: { select: { totalAmount: true } } },
    });
    if (!payment) throw new NotFoundException("Order not found");

    // The signature proves the browser got this pair from Razorpay. Razorpay itself confirms the
    // order, the amount and the status before the order is marked paid.
    const confirmed = await this.gateway.fetchPayment(dto.razorpayPaymentId);
    if (
      confirmed.orderId !== dto.razorpayOrderId ||
      confirmed.amount !== toPaise(payment.order.totalAmount)
    ) {
      throw new BadRequestException("Payment verification failed");
    }
    if (confirmed.status !== "captured" && confirmed.status !== "authorized") {
      throw new BadRequestException("This payment has not gone through");
    }

    const outcome = await this.payments.applyCapture({
      providerOrderId: dto.razorpayOrderId,
      providerPaymentId: dto.razorpayPaymentId,
      paymentStatus: confirmed.status === "captured" ? "CAPTURED" : "AUTHORIZED",
      method: confirmed.method,
    });
    if (outcome === "order_closed") {
      throw new ConflictException(
        "This order has expired and its stock was released. Contact support with your payment reference.",
      );
    }

    const order = await this.prisma.order.findFirstOrThrow({
      where: { payments: { some: { providerOrderId: dto.razorpayOrderId } } },
      include: { items: true, shipments: true },
    });
    return presentOrder(order);
  }

  private assertCheckoutable(priced: PricedCart): void {
    if (priced.couponError) {
      throw new BadRequestException(priced.couponError);
    }
    if (priced.issues.length > 0) {
      throw new ConflictException({
        message: "Some items in your bag are no longer available. Please review your bag.",
        details: priced.issues.map((issue) => issue.message),
      });
    }
    if (!priced.canCheckout) {
      throw new BadRequestException("Your bag cannot be checked out right now");
    }
  }

  /** Re-reads prices inside the transaction. If they moved since the quote, the customer must review again. */
  private async assertPricesUnchanged(
    tx: Prisma.TransactionClient,
    priced: PricedCart,
  ): Promise<void> {
    const current = await tx.product.findMany({
      where: { id: { in: priced.lines.map((line) => line.product.id) } },
      select: { id: true, price: true },
    });
    const byId = new Map(current.map((product) => [product.id, product.price]));
    for (const line of priced.lines) {
      const price = byId.get(line.product.id);
      if (!price || !price.equals(line.unitPrice)) {
        throw new ConflictException("Prices have changed. Please review your bag and try again.");
      }
    }
  }

  private findByIdempotencyKey(key: string) {
    return this.prisma.order.findUnique({
      where: { idempotencyKey: key },
      include: { items: true, payments: true, shipments: true },
    });
  }

  private viewWithPayment(
    order: Prisma.OrderGetPayload<{ include: { items: true; payments: true; shipments: true } }>,
  ): CheckoutOrderView {
    const payment = order.payments[0];
    if (!payment || !this.integrations.razorpay) {
      throw new ConflictException("This order has no payment attached");
    }
    return {
      order: presentOrder(order),
      payment: {
        provider: "razorpay",
        keyId: this.integrations.razorpay.keyId,
        razorpayOrderId: payment.providerOrderId,
        amount: toPaise(payment.amount),
        currency: "INR",
      },
    };
  }
}
