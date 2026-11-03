"use client";

// Loads Razorpay Checkout (the official script, served by Razorpay) and opens its payment modal.
// The modal returns a signature to the browser. Only the server can verify it, so the page must
// send it on to the API, which does that check before any order is marked paid.

export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayOpenOptions {
  key: string;
  amount: number;
  currency: "INR";
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string | undefined; email?: string | undefined; contact?: string | undefined };
  theme?: { color: string };
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open(): void;
  on(
    event: "payment.failed",
    handler: (response: { error?: { description?: string } }) => void,
  ): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOpenOptions) => RazorpayInstance;
  }
}

const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

export function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.src = SCRIPT_URL;
      script.async = true;
      document.body.appendChild(script);
    }
    script.addEventListener(
      "load",
      () => {
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => {
        reject(new Error("Payment window could not be loaded"));
      },
      { once: true },
    );
  });
}

export async function openRazorpay(
  options: RazorpayOpenOptions & { onFailure: (message: string) => void },
): Promise<void> {
  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error("Payment window is not available");

  const instance = new window.Razorpay(options);
  instance.on("payment.failed", (response) => {
    options.onFailure(response.error?.description ?? "The payment did not go through.");
  });
  instance.open();
}
