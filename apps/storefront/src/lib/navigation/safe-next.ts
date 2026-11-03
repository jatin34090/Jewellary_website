/**
 * Only same-site paths are allowed as redirect targets after sign-in, so a crafted link
 * cannot send a customer to another website.
 */
export function safeNextPath(value: string | string[] | undefined, fallback = "/account"): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\")
  ) {
    return fallback;
  }
  return candidate;
}
