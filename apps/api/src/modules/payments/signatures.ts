import { createHmac, timingSafeEqual } from "node:crypto";

/** Hex HMAC-SHA256 of a payload with a secret. This is how Razorpay signs checkout results and webhooks. */
export function hmacSha256Hex(secret: string, payload: string | Buffer): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Constant-time comparison, so the response time does not reveal how much of a signature matched. */
export function safeEqualHex(expected: string, received: string): boolean {
  if (!/^[a-f0-9]+$/i.test(received) || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

/** Checkout signature: HMAC of "order_id|payment_id" with the key secret. */
export function verifyCheckoutSignature(
  keySecret: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
): boolean {
  return safeEqualHex(
    hmacSha256Hex(keySecret, `${razorpayOrderId}|${razorpayPaymentId}`),
    signature,
  );
}

/** Webhook signature: HMAC of the exact raw request body with the webhook secret. */
export function verifyWebhookSignature(
  webhookSecret: string,
  rawBody: Buffer,
  signature: string,
): boolean {
  return safeEqualHex(hmacSha256Hex(webhookSecret, rawBody), signature);
}
