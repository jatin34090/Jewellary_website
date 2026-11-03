import { Logger } from "@nestjs/common";

const BASE_URL = "https://apiv2.shiprocket.in/v1/external";
const REQUEST_TIMEOUT_MS = 15_000;
/** Shiprocket tokens are valid for about 10 days. Refresh a little earlier. */
const TOKEN_LIFETIME_MS = 9 * 24 * 60 * 60 * 1000;

export interface ShiprocketCredentials {
  email: string;
  password: string;
}

export interface ShiprocketOrderPayload {
  order_id: string;
  order_date: string;
  pickup_location: string;
  billing_customer_name: string;
  billing_last_name: string;
  billing_address: string;
  billing_address_2: string;
  billing_city: string;
  billing_pincode: string;
  billing_state: string;
  billing_country: string;
  billing_email: string;
  billing_phone: string;
  shipping_is_billing: boolean;
  order_items: {
    name: string;
    sku: string;
    units: number;
    selling_price: string;
    discount: string;
    tax: string;
  }[];
  payment_method: "Prepaid";
  shipping_charges: number;
  total_discount: number;
  sub_total: number;
  length: number;
  breadth: number;
  height: number;
  weight: number;
}

export interface ShiprocketCreatedOrder {
  order_id?: number;
  shipment_id?: number;
}

export interface ShiprocketAwb {
  awb_code: string;
  courier_name: string;
}

/**
 * Minimal Shiprocket API client: login, create an order, and assign a courier AWB.
 * Responses are checked before use, and error bodies are never logged in full.
 */
export class ShiprocketClient {
  private readonly logger = new Logger("Shiprocket");
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly credentials: ShiprocketCredentials) {}

  private async authToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;

    const response = await this.request("/auth/login", {
      method: "POST",
      body: this.credentials,
    });
    const value = (response as { token?: unknown }).token;
    if (typeof value !== "string") throw new Error("Shiprocket login did not return a token");

    this.token = { value, expiresAt: Date.now() + TOKEN_LIFETIME_MS };
    return value;
  }

  async createOrder(payload: ShiprocketOrderPayload): Promise<ShiprocketCreatedOrder> {
    const response = await this.request("/orders/create/adhoc", {
      method: "POST",
      body: payload,
      authorised: true,
    });
    return response as ShiprocketCreatedOrder;
  }

  async assignAwb(shipmentId: number): Promise<ShiprocketAwb> {
    const response = (await this.request("/courier/assign/awb", {
      method: "POST",
      body: { shipment_id: shipmentId },
      authorised: true,
    })) as { response?: { data?: { awb_code?: unknown; courier_name?: unknown } } };

    const data = response.response?.data;
    if (!data || typeof data.awb_code !== "string" || typeof data.courier_name !== "string") {
      throw new Error("Shiprocket did not assign an AWB");
    }
    return { awb_code: data.awb_code, courier_name: data.courier_name };
  }

  private async request(
    path: string,
    options: { method: "POST"; body: unknown; authorised?: boolean },
  ): Promise<unknown> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (options.authorised) headers["Authorization"] = `Bearer ${await this.authToken()}`;

    const response = await fetch(`${BASE_URL}${path}`, {
      method: options.method,
      headers,
      body: JSON.stringify(options.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      this.logger.warn(`Shiprocket ${path} failed with status ${response.status}`);
      throw new Error(`Shiprocket request failed (${response.status})`);
    }
    return response.json();
  }
}
