import { BadRequestException, Logger, ServiceUnavailableException } from "@nestjs/common";

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

/** A payment as Razorpay reports it. Used to confirm what the browser says, never trusted on its own. */
export interface GatewayPayment {
  id: string;
  orderId: string;
  /** Amount in paise. */
  amount: number;
  status: string;
  method?: string | undefined;
}

export interface RefundPaymentInput {
  /** Razorpay payment id (pay_...) of the captured payment. */
  providerPaymentId: string;
  /** Amount in paise. */
  amountPaise: number;
  /** Our refund id, so the Razorpay dashboard can be matched to refunds. */
  receipt: string;
  notes: Record<string, string>;
}

/**
 * A refund as Razorpay reports it. status is exactly what the provider said: "pending",
 * "processed" or "failed". Nothing defaults it, so an unexpected value cannot close an order.
 */
export interface GatewayRefund {
  id: string;
  /** Amount in paise. */
  amount: number;
  status: string;
  paymentId: string | null;
  receipt: string | null;
}

/**
 * The provider rejected the refund outright (for example the amount is too large). Nothing moved,
 * so the refund can be marked failed and retried with a corrected amount.
 */
export class RefundRejectedError extends BadRequestException {}

/** The payment gateway as seen by the rest of the application. Tests substitute it; production uses Razorpay. */
export interface PaymentGateway {
  readonly keyId: string | undefined;
  createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder>;
  refundPayment(input: RefundPaymentInput): Promise<GatewayRefund>;
  fetchRefund(providerRefundId: string): Promise<GatewayRefund>;
  listPaymentRefunds(providerPaymentId: string): Promise<GatewayRefund[]>;
  fetchPayment(providerPaymentId: string): Promise<GatewayPayment>;
}

export const PAYMENT_GATEWAY = Symbol("PAYMENT_GATEWAY");

const RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders";
const RAZORPAY_PAYMENTS_URL = "https://api.razorpay.com/v1/payments";
const RAZORPAY_REFUNDS_URL = "https://api.razorpay.com/v1/refunds";
const UNKNOWN_REFUND_MESSAGE =
  "The refund outcome is unknown. Check the Razorpay dashboard before trying again.";
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

  /** Reads a payment straight from Razorpay, so the amount and status come from the provider. */
  async fetchPayment(providerPaymentId: string): Promise<GatewayPayment> {
    const response = await fetch(`${RAZORPAY_PAYMENTS_URL}/${providerPaymentId}`, {
      headers: { Authorization: this.authorization },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      this.logger.error(`Razorpay payment lookup failed with status ${response.status}`);
      throw new ServiceUnavailableException("Payment provider is unavailable. Please try again.");
    }
    const body = (await response.json()) as Partial<{
      id: string;
      order_id: string;
      amount: number;
      status: string;
      method: string;
    }>;
    if (
      typeof body.id !== "string" ||
      typeof body.order_id !== "string" ||
      typeof body.amount !== "number"
    ) {
      throw new ServiceUnavailableException("Payment provider returned an unexpected response");
    }
    return {
      id: body.id,
      orderId: body.order_id,
      amount: body.amount,
      status: body.status ?? "unknown",
      method: body.method,
    };
  }

  /**
   * Issues a refund against a captured payment. A 4xx answer means nothing moved and is reported
   * as RefundRejectedError. Anything else (timeout, 5xx) leaves the outcome unknown, so the caller
   * must not mark it failed: the refund may have gone through.
   */
  async refundPayment(input: RefundPaymentInput): Promise<GatewayRefund> {
    const response = await fetch(`${RAZORPAY_PAYMENTS_URL}/${input.providerPaymentId}/refund`, {
      method: "POST",
      headers: {
        Authorization: this.authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amountPaise,
        receipt: input.receipt,
        notes: input.notes,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status >= 400 && response.status < 500) {
      const body = (await response.json().catch(() => null)) as {
        error?: { description?: string };
      } | null;
      throw new RefundRejectedError(
        body?.error?.description?.slice(0, 200) ?? "The payment provider rejected the refund",
      );
    }
    if (!response.ok) {
      this.logger.error(`Razorpay refund failed with status ${response.status}`);
      throw new ServiceUnavailableException(
        "The refund outcome is unknown. Check the Razorpay dashboard before trying again.",
      );
    }

    return parseRefund(await response.json());
  }

  /** Reads one refund from Razorpay, so a pending refund can be checked later. */
  async fetchRefund(providerRefundId: string): Promise<GatewayRefund> {
    const response = await fetch(`${RAZORPAY_REFUNDS_URL}/${providerRefundId}`, {
      headers: { Authorization: this.authorization },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      this.logger.error(`Razorpay refund lookup failed with status ${response.status}`);
      throw new ServiceUnavailableException(
        "Razorpay did not answer. Try the refresh again shortly.",
      );
    }
    return parseRefund(await response.json());
  }

  /**
   * Lists the refunds Razorpay holds for a payment. Used to find a refund whose first response was
   * lost: our refund id is sent as the receipt, so the match is exact.
   */
  async listPaymentRefunds(providerPaymentId: string): Promise<GatewayRefund[]> {
    const response = await fetch(`${RAZORPAY_PAYMENTS_URL}/${providerPaymentId}/refunds`, {
      headers: { Authorization: this.authorization },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      this.logger.error(`Razorpay refund list failed with status ${response.status}`);
      throw new ServiceUnavailableException(
        "Razorpay did not answer. Try the refresh again shortly.",
      );
    }
    const body = (await response.json()) as { items?: unknown };
    if (!Array.isArray(body.items)) {
      throw new ServiceUnavailableException(UNKNOWN_REFUND_MESSAGE);
    }
    return body.items.map(parseRefund);
  }
}

/** Validates a refund object from Razorpay. Anything missing or mistyped makes the outcome unknown. */
function parseRefund(value: unknown): GatewayRefund {
  const body: Record<string, unknown> =
    typeof value === "object" && value !== null ? { ...value } : {};
  const id = body["id"];
  const amount = body["amount"];
  const status = body["status"];
  const paymentId = body["payment_id"];
  const receipt = body["receipt"];
  if (typeof id !== "string" || typeof amount !== "number" || typeof status !== "string") {
    throw new ServiceUnavailableException(UNKNOWN_REFUND_MESSAGE);
  }
  return {
    id,
    amount,
    status,
    paymentId: typeof paymentId === "string" ? paymentId : null,
    receipt: typeof receipt === "string" ? receipt : null,
  };
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

  fetchPayment(): Promise<GatewayPayment> {
    return Promise.reject(
      new ServiceUnavailableException("Online payments are not configured yet"),
    );
  }

  refundPayment(): Promise<GatewayRefund> {
    return Promise.reject(
      new ServiceUnavailableException(
        "Refunds need the Razorpay keys. Add them to the environment first.",
      ),
    );
  }

  fetchRefund(): Promise<GatewayRefund> {
    return Promise.reject(new ServiceUnavailableException("Refunds need the Razorpay keys."));
  }

  listPaymentRefunds(): Promise<GatewayRefund[]> {
    return Promise.reject(new ServiceUnavailableException("Refunds need the Razorpay keys."));
  }
}

export function gatewayFrom(integrations: Integrations): PaymentGateway {
  return integrations.razorpay
    ? new RazorpayGateway(integrations.razorpay.keyId, integrations.razorpay.keySecret)
    : new UnconfiguredGateway();
}
