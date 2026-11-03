import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { isCloudinaryUrl, signCloudinaryParams, videoPosterUrl } from "./cloudinary";
import { formatShiprocketDate, trackingUrlFor } from "../shipping/shipments.service";

describe("Cloudinary signing", () => {
  it("signs parameters in alphabetical order, appending the secret", () => {
    const signature = signCloudinaryParams(
      { timestamp: 1700000000, folder: "vrinoor/images" },
      "secret",
    );
    const expected = createHash("sha1")
      .update("folder=vrinoor/images&timestamp=1700000000secret")
      .digest("hex");
    expect(signature).toBe(expected);
  });

  it("does not depend on the order the parameters are given in", () => {
    const a = signCloudinaryParams({ folder: "f", timestamp: 1, allowed_formats: "mp4" }, "s");
    const b = signCloudinaryParams({ allowed_formats: "mp4", timestamp: 1, folder: "f" }, "s");
    expect(a).toBe(b);
  });
});

describe("Cloudinary URLs", () => {
  it("accepts only https Cloudinary URLs, and for the configured account when known", () => {
    expect(isCloudinaryUrl("https://res.cloudinary.com/demo/image/upload/a.jpg")).toBe(true);
    expect(isCloudinaryUrl("https://res.cloudinary.com/demo/image/upload/a.jpg", "demo")).toBe(
      true,
    );
    expect(isCloudinaryUrl("https://res.cloudinary.com/other/image/upload/a.jpg", "demo")).toBe(
      false,
    );
    expect(isCloudinaryUrl("http://res.cloudinary.com/demo/image/upload/a.jpg")).toBe(false);
    expect(isCloudinaryUrl("https://evil.example.com/res.cloudinary.com/a.jpg")).toBe(false);
    expect(isCloudinaryUrl("javascript:alert(1)")).toBe(false);
  });

  it("derives a JPEG poster frame from a video URL", () => {
    expect(
      videoPosterUrl("https://res.cloudinary.com/demo/video/upload/v1/vrinoor/videos/ring.mp4"),
    ).toBe("https://res.cloudinary.com/demo/video/upload/so_0/v1/vrinoor/videos/ring.jpg");
    expect(videoPosterUrl("https://res.cloudinary.com/demo/image/upload/a.jpg")).toBeNull();
  });
});

describe("Shiprocket helpers", () => {
  it("formats the order date in IST as Shiprocket expects", () => {
    // 2026-11-03T04:30:00Z is 10:00 in India.
    expect(formatShiprocketDate(new Date("2026-11-03T04:30:00Z"))).toBe("2026-11-03 10:00");
  });

  it("builds an encoded tracking link", () => {
    expect(trackingUrlFor("1234 5678")).toBe("https://shiprocket.co/tracking/1234%205678");
  });
});
