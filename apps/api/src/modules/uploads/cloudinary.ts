import { createHash } from "node:crypto";

export const IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp", "avif"] as const;
export const VIDEO_FORMATS = ["mp4", "mov", "webm"] as const;

/**
 * Cloudinary signature: sort the signed parameters by name, join them as key=value with "&",
 * append the API secret, and take the SHA-1 hex digest. Parameters that are not signed (api_key,
 * file, resource_type) are left out.
 */
export function signCloudinaryParams(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex");
}

/**
 * True when a URL is a Cloudinary delivery URL. When the cloud name is known, the URL must belong to
 * that account, so one store cannot point its product at another account's media.
 */
export function isCloudinaryUrl(url: string, cloudName?: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com") return false;
  if (!cloudName) return true;
  return parsed.pathname.startsWith(`/${cloudName}/`);
}

/** A video poster frame, taken from the first second of the video and served as a JPEG. */
export function videoPosterUrl(videoUrl: string): string | null {
  if (!videoUrl.includes("/video/upload/")) return null;
  return videoUrl
    .replace("/video/upload/", "/video/upload/so_0/")
    .replace(/\.(mp4|mov|webm)(\?.*)?$/i, ".jpg");
}
