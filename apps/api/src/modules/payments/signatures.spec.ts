import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { safeEqualHex, verifyCheckoutSignature, verifyWebhookSignature } from "./signatures";

const sign = (secret: string, payload: string) =>
  createHmac("sha256", secret).update(payload).digest("hex");

describe("payment signatures", () => {
  it("accepts a checkout signature made from order id and payment id with the key secret", () => {
    const signature = sign("key-secret", "order_A|pay_B");
    expect(verifyCheckoutSignature("key-secret", "order_A", "pay_B", signature)).toBe(true);
  });

  it("rejects a checkout signature for a different payment, order or secret", () => {
    const signature = sign("key-secret", "order_A|pay_B");
    expect(verifyCheckoutSignature("key-secret", "order_A", "pay_OTHER", signature)).toBe(false);
    expect(verifyCheckoutSignature("key-secret", "order_OTHER", "pay_B", signature)).toBe(false);
    expect(verifyCheckoutSignature("wrong-secret", "order_A", "pay_B", signature)).toBe(false);
  });

  it("verifies webhooks against the exact raw body", () => {
    const body = Buffer.from('{"event":"payment.captured"}');
    const signature = createHmac("sha256", "hook-secret").update(body).digest("hex");
    expect(verifyWebhookSignature("hook-secret", body, signature)).toBe(true);
    expect(
      verifyWebhookSignature(
        "hook-secret",
        Buffer.from('{"event":"payment.captured" }'),
        signature,
      ),
    ).toBe(false);
  });

  it("rejects malformed or wrong-length signatures without throwing", () => {
    expect(safeEqualHex("abcd", "zz")).toBe(false);
    expect(safeEqualHex("abcd", "abc")).toBe(false);
    expect(safeEqualHex("abcd", "")).toBe(false);
  });
});
