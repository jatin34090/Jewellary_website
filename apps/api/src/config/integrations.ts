/**
 * Third-party service settings. Every block is optional: when a service is not configured, the
 * features that need it report "not configured" instead of failing at startup or faking a result.
 */
export interface Integrations {
  razorpay: { keyId: string; keySecret: string; webhookSecret: string | undefined } | undefined;
  shiprocket:
    | {
        email: string;
        password: string;
        pickupLocation: string;
        defaultWeightKg: number;
        defaultLengthCm: number;
        defaultBreadthCm: number;
        defaultHeightCm: number;
      }
    | undefined;
  cloudinary: { cloudName: string; apiKey: string; apiSecret: string; folder: string } | undefined;
  reservationMinutes: number;
  orderSweepIntervalMs: number;
}

function value(source: NodeJS.ProcessEnv, name: string): string | undefined {
  const raw = source[name]?.trim();
  return raw ? raw : undefined;
}

function number(source: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = value(source, name);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadIntegrations(source: NodeJS.ProcessEnv = process.env): Integrations {
  const razorpayKeyId = value(source, "RAZORPAY_KEY_ID");
  const razorpayKeySecret = value(source, "RAZORPAY_KEY_SECRET");

  const shipEmail = value(source, "SHIPROCKET_EMAIL");
  const shipPassword = value(source, "SHIPROCKET_PASSWORD");
  const shipPickup = value(source, "SHIPROCKET_PICKUP_LOCATION");

  const cloudName = value(source, "CLOUDINARY_CLOUD_NAME");
  const cloudKey = value(source, "CLOUDINARY_API_KEY");
  const cloudSecret = value(source, "CLOUDINARY_API_SECRET");

  return {
    razorpay:
      razorpayKeyId && razorpayKeySecret
        ? {
            keyId: razorpayKeyId,
            keySecret: razorpayKeySecret,
            webhookSecret: value(source, "RAZORPAY_WEBHOOK_SECRET"),
          }
        : undefined,
    shiprocket:
      shipEmail && shipPassword && shipPickup
        ? {
            email: shipEmail,
            password: shipPassword,
            pickupLocation: shipPickup,
            defaultWeightKg: number(source, "SHIPROCKET_DEFAULT_WEIGHT_KG", 0.1),
            defaultLengthCm: number(source, "SHIPROCKET_DEFAULT_LENGTH_CM", 10),
            defaultBreadthCm: number(source, "SHIPROCKET_DEFAULT_BREADTH_CM", 10),
            defaultHeightCm: number(source, "SHIPROCKET_DEFAULT_HEIGHT_CM", 5),
          }
        : undefined,
    cloudinary:
      cloudName && cloudKey && cloudSecret
        ? {
            cloudName,
            apiKey: cloudKey,
            apiSecret: cloudSecret,
            folder: value(source, "CLOUDINARY_UPLOAD_FOLDER") ?? "vrinoor",
          }
        : undefined,
    reservationMinutes: number(source, "ORDER_RESERVATION_MINUTES", 30),
    orderSweepIntervalMs: number(source, "ORDER_SWEEP_INTERVAL_MS", 60_000),
  };
}
