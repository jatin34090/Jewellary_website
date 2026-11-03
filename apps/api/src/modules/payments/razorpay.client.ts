import { Logger, ServiceUnavailableException } from "@nestjs/common";

import type { Integrations } from "../../config/integrations";

export interface CreateGatewayOrderInput {
  /** Amount in paise (1 INR = 100 paise). */
  amountPaise: number;
  currency: string;
  /** Our order number, so the Razorpay dashboard can be matched to orders. */
  receipt: string;
  notes: Record<string, string>;
}

export interface GatewayOrder {
  id: string;
  amount: number;
  currency: string;
}

/** The payment gateway as seen by the rest of the application. Tests substitute it; production uses Razorpay. */
export interface PaymentGateway {
  readonly keyId: string | undefined;
  createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder>;
}

export const PAYMENT_GATEWAY = Symbol("PAYMENT_GATEWAY");

const RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders";
const REQUEST_TIMEOUT_MS = 10_000;

/** Calls the Razorpay Orders API with HTTP Basic auth (key id and key secret). */
export class RazorpayGateway implements PaymentGateway {
  private readonly logger = new Logger("Razorpay");
  readonly keyId: string;
  private readonly authorization: string;

  constructor(keyId: string, keySecret: string) {
    this.keyId = keyId;
    this.authorization = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
  }

  async createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder> {
    const response = await fetch(RAZORPAY_ORDERS_URL, {
      method: "POST",
      headers: {
        Authorization: this.authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Log the status only. The response body can echo details we do not want in logs.
      this.logger.error(`Razorpay order creation failed with status ${response.status}`);
      throw new ServiceUnavailableException("Payment provider is unavailable. Please try again.");
    }

    const body = (await response.json()) as Partial<GatewayOrder>;
    if (typeof body.id !== "string" || typeof body.amount !== "number") {
      throw new ServiceUnavailableException("Payment provider returned an unexpected response");
    }
    return { id: body.id, amount: body.amount, currency: body.currency ?? input.currency };
  }
}

/** Used when Razorpay keys are not set. Checkout then reports a clear message instead of failing silently. */
export class UnconfiguredGateway implements PaymentGateway {
  readonly keyId = undefined;

  createOrder(): Promise<GatewayOrder> {
    return Promise.reject(
      new ServiceUnavailableException(
        "Online payments are not configured yet. Ask the store owner to add the Razorpay keys.",
      ),
    );
  }
}

export function gatewayFrom(integrations: Integrations): PaymentGateway {
  return integrations.razorpay
    ? new RazorpayGateway(integrations.razorpay.keyId, integrations.razorpay.keySecret)
    : new UnconfiguredGateway();
}
